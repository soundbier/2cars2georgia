/**
 * Ausgangspuffer für Trackpunkte.
 *
 * Bis hierher ging jeder GPS-Punkt direkt per addDoc an Firestore. Offline
 * fängt der persistentLocalCache das zwar auf, aber nur solange der Tab lebt
 * und der Punkt es überhaupt bis in die SDK-Warteschlange geschafft hat: Wird
 * die App vom Betriebssystem beendet – auf dem Handy im Hintergrund der
 * Normalfall –, ist alles verloren, was Firestore noch nicht bestätigt hat.
 * Genau das ist auf der ersten Probefahrt passiert.
 *
 * Deshalb liegt zwischen Ortung und Firestore jetzt ein eigener Puffer: Jeder
 * Punkt wird zuerst hier festgeschrieben und erst gelöscht, wenn der Server
 * ihn bestätigt hat (siehe lib/trackUploader.ts). Der Puffer liegt in
 * IndexedDB – groß genug für tagelange Aufzeichnung, überlebt Neustart und
 * App-Kill, und ist ohne Netz sofort schreibbar.
 *
 * Die Kennung eines Punktes ist bewusst aus Aufzeichnung und Zeitstempel
 * abgeleitet und nicht zufällig: Sie wird später zur Firestore-Dokument-ID.
 * Läuft derselbe Punkt zweimal hoch (Puffer und SDK-Warteschlange nach einem
 * Neustart), landet er dadurch auf demselben Dokument statt doppelt in der
 * Spur.
 */

import { GpsPoint } from '../types';

const DB_NAME = 'boat-track-buffer';
const DB_VERSION = 1;
const STORE = 'points';

/**
 * Obergrenze des Puffers.
 *
 * Bei 5 Sekunden Intervall sind das rund 14 Tage ununterbrochener
 * Aufzeichnung ohne jedes Netz – jenseits davon ist etwas anderes kaputt als
 * die Verbindung. Läuft er trotzdem über, fallen die ältesten Punkte heraus:
 * Die jüngeren gehören zur Fahrt, an der die Crew gerade sitzt.
 */
export const MAX_BUFFERED_POINTS = 250_000;

/** Ein gepufferter Punkt, so wie er in IndexedDB liegt. */
export interface BufferedPoint {
  /** Zugleich die spätere Firestore-Dokument-ID. */
  id: string;
  tripId: string;
  point: GpsPoint;
  /** Wann der Punkt in den Puffer kam – bestimmt die Reihenfolge beim Hochladen. */
  queuedAt: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let queuedCount = 0;

function notify() {
  for (const listener of listeners) listener();
}

function setCount(next: number) {
  if (next === queuedCount) return;
  queuedCount = next;
  notify();
}

/**
 * Kennung eines Trackpunkts.
 *
 * Aufzeichnung plus Zeitstempel: In einer Aufzeichnung gibt es pro Zeitpunkt
 * genau einen Punkt, und die Aufzeichnungs-Kennung ist geräteweit eindeutig
 * (lib/trackSession.ts). Punkte ohne Aufzeichnung – die es im Normalbetrieb
 * nicht gibt, weil nur während einer Tour gespeichert wird – bekommen eine
 * zufällige Kennung, damit sie sich nicht gegenseitig überschreiben.
 */
export function trackPointId(point: GpsPoint): string {
  if (point.sessionId) return `${point.sessionId}_${point.timestamp}`;
  return `p_${point.timestamp}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- Speicher: IndexedDB, mit Rückfallebene im Arbeitsspeicher -------------
//
// Ohne IndexedDB (Privatmodus mancher Browser, Testumgebung) soll die
// Aufzeichnung nicht ausfallen, sondern nur ihre Haltbarkeit über den
// App-Neustart hinaus verlieren. Deshalb dieselbe Schnittstelle zweimal.

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryStore = new Map<string, BufferedPoint>();
let useMemory = typeof indexedDB === 'undefined';

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          // Hochgeladen wird in der Reihenfolge der Aufnahme, nicht in der
          // Reihenfolge der Kennungen.
          store.createIndex('queuedAt', 'queuedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((err) => {
      // Einmal umschalten und danach still weiterarbeiten: Ein Puffer im
      // Arbeitsspeicher ist deutlich besser als eine Aufzeichnung, die bei
      // jedem Punkt eine Ausnahme wirft.
      console.error('Track-Puffer konnte nicht geöffnet werden:', err);
      useMemory = true;
      throw err;
    });
  }
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const result = await work(tx.objectStore(STORE));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

/**
 * Nimmt einen Punkt in den Puffer auf.
 *
 * Bewusst ohne Rückgabe eines Fehlers an den Aufrufer: Schlägt selbst das
 * fehl, ist der Punkt verloren – daran ändert eine Ausnahme im
 * Geolocation-Callback nichts, sie würde nur die restliche Aufzeichnung
 * mitreißen.
 */
export async function enqueueTrackPoint(tripId: string, point: GpsPoint): Promise<void> {
  const entry: BufferedPoint = { id: trackPointId(point), tripId, point, queuedAt: point.timestamp };
  try {
    if (useMemory) {
      memoryStore.set(entry.id, entry);
      await pruneMemory();
      setCount(memoryStore.size);
      return;
    }
    await withStore('readwrite', async (store) => {
      await requestResult(store.put(entry));
    });
    await prune();
    await refreshQueuedCount();
  } catch (err) {
    console.error('Trackpunkt konnte nicht gepuffert werden:', err);
    if (useMemory) {
      memoryStore.set(entry.id, entry);
      setCount(memoryStore.size);
    }
  }
}

async function pruneMemory(): Promise<void> {
  if (memoryStore.size <= MAX_BUFFERED_POINTS) return;
  const ordered = [...memoryStore.values()].sort((a, b) => a.queuedAt - b.queuedAt);
  for (const entry of ordered.slice(0, memoryStore.size - MAX_BUFFERED_POINTS)) {
    memoryStore.delete(entry.id);
  }
}

async function prune(): Promise<void> {
  await withStore('readwrite', async (store) => {
    const total = await requestResult(store.count());
    if (total <= MAX_BUFFERED_POINTS) return;
    let remaining = total - MAX_BUFFERED_POINTS;
    const cursorRequest = store.index('queuedAt').openCursor();
    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || remaining <= 0) {
          resolve();
          return;
        }
        cursor.delete();
        remaining -= 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
    console.warn(`Track-Puffer übergelaufen, ${total - MAX_BUFFERED_POINTS} alte Punkte verworfen.`);
  });
}

/** Die ältesten gepufferten Punkte, in der Reihenfolge der Aufnahme. */
export async function readQueuedPoints(limit: number): Promise<BufferedPoint[]> {
  if (limit <= 0) return [];
  try {
    if (useMemory) {
      return [...memoryStore.values()].sort((a, b) => a.queuedAt - b.queuedAt).slice(0, limit);
    }
    return await withStore('readonly', async (store) => {
      const entries: BufferedPoint[] = [];
      const cursorRequest = store.index('queuedAt').openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || entries.length >= limit) {
            resolve();
            return;
          }
          entries.push(cursor.value as BufferedPoint);
          cursor.continue();
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
      return entries;
    });
  } catch (err) {
    console.error('Track-Puffer konnte nicht gelesen werden:', err);
    return [];
  }
}

/** Entfernt bestätigte (oder endgültig verworfene) Punkte aus dem Puffer. */
export async function removeQueuedPoints(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    if (useMemory) {
      for (const id of ids) memoryStore.delete(id);
      setCount(memoryStore.size);
      return;
    }
    await withStore('readwrite', async (store) => {
      for (const id of ids) store.delete(id);
    });
    await refreshQueuedCount();
  } catch (err) {
    console.error('Bestätigte Trackpunkte konnten nicht aus dem Puffer entfernt werden:', err);
  }
}

/**
 * Der zuletzt ermittelte Füllstand.
 *
 * Synchron, damit die Anzeige ihn ohne Umweg über einen Effekt lesen kann
 * (useSyncExternalStore); aktualisiert wird er bei jeder Änderung durch
 * diesen Modul und beim Start über refreshQueuedCount().
 */
export function getQueuedCount(): number {
  return queuedCount;
}

export function subscribeQueuedCount(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Liest den Füllstand neu aus dem Speicher – beim Start und nach dem Hochladen. */
export async function refreshQueuedCount(): Promise<number> {
  try {
    const total = useMemory
      ? memoryStore.size
      : await withStore('readonly', (store) => requestResult(store.count()));
    setCount(total);
    return total;
  } catch (err) {
    console.error('Füllstand des Track-Puffers konnte nicht gelesen werden:', err);
    return queuedCount;
  }
}

/** Nur für Tests: leert Puffer, Zähler und Listener. */
export async function __resetTrackBufferForTests(): Promise<void> {
  memoryStore.clear();
  useMemory = typeof indexedDB === 'undefined';
  if (!useMemory) {
    try {
      await withStore('readwrite', async (store) => {
        await requestResult(store.clear());
      });
    } catch {
      // Ohne geöffnete Datenbank gibt es auch nichts zu leeren.
    }
  }
  listeners.clear();
  queuedCount = 0;
}
