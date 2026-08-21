/**
 * Der Weg vom Puffer nach Firestore.
 *
 * Der Puffer (lib/trackBuffer.ts) ist die Wahrheit über die gefahrene Strecke,
 * Firestore ist die Kopie für die Crew. Diese Datei bringt beides zusammen:
 * Sie nimmt die ältesten gepufferten Punkte, schreibt sie in Stapeln und
 * löscht sie erst, wenn der Server den Stapel bestätigt hat.
 *
 * Bewusst weiß sie nichts über Firestore selbst – das Schreiben wird als
 * Funktion hereingereicht. Dadurch bleibt die Ablauflogik (Stapelgröße,
 * Wiederholung, Umgang mit einem Punkt, den der Server dauerhaft ablehnt)
 * ohne Firestore-Attrappe testbar.
 */

import { BufferedPoint, readQueuedPoints, removeQueuedPoints } from './trackBuffer';

/**
 * Punkte je Schreibvorgang.
 *
 * Firestore erlaubt 500 Schreibvorgänge pro Batch. 200 lässt Luft und hält
 * die Menge, die ein abgebrochener Stapel wiederholen muss, klein.
 */
export const UPLOAD_BATCH_SIZE = 200;

/**
 * Wie oft ein einzelner Punkt scheitern darf, bevor er verworfen wird.
 *
 * Nur für Fehler, die keine Wiederholung heilt (siehe isPermanent). Ohne
 * diese Grenze blockiert ein einziger unschreibbarer Punkt für immer den
 * gesamten Rest der Fahrt.
 */
const MAX_ATTEMPTS_PER_POINT = 3;

/** Schreibt einen Stapel; löst erst auf, wenn der Server ihn bestätigt hat. */
export type CommitPoints = (entries: BufferedPoint[]) => Promise<void>;

export interface FlushOptions {
  /**
   * Punkte, um die sich gerade schon jemand anders kümmert.
   *
   * Jeder frische Punkt geht sofort einzeln nach Firestore, damit er ohne
   * Umweg auf der Karte steht (siehe hooks/useTracking.tsx); erst wenn das
   * nicht geklappt hat, ist der Nachschub aus dem Puffer dran. Ohne diese
   * Ausnahme würde derselbe Punkt zweimal geschrieben – zwar auf dasselbe
   * Dokument, aber eben auch auf Kosten des Datenvolumens.
   */
  skip?: (entry: BufferedPoint) => boolean;
}

export interface FlushResult {
  /** Vom Server bestätigte Punkte. */
  uploaded: number;
  /** Punkte, die der Server dauerhaft ablehnt und die deshalb wegfallen. */
  dropped: number;
  /** true, wenn abgebrochen wurde und der Rest später erneut versucht wird. */
  interrupted: boolean;
}

interface FirestoreLikeError {
  code?: string;
}

/**
 * Fehler, den keine Wiederholung heilt.
 *
 * Alles andere – vor allem `unavailable` ohne Netz – bleibt im Puffer stehen
 * und wird beim nächsten Versuch erneut geschrieben.
 */
function isPermanent(err: unknown): boolean {
  const code = (err as FirestoreLikeError)?.code;
  return code === 'permission-denied' || code === 'invalid-argument' || code === 'not-found';
}

// Ein einziger Durchlauf zur Zeit: Ohne Netz bleibt ein Stapel offen, bis die
// Verbindung zurück ist. Jeder weitere Aufruf in dieser Zeit bekommt denselben
// Durchlauf zurück, statt einen zweiten daneben zu stellen.
let running: Promise<FlushResult> | null = null;
const attempts = new Map<string, number>();

/**
 * Leert den Puffer, soweit der Server mitspielt.
 *
 * Läuft, bis nichts mehr da ist oder ein Fehler die Wiederholung erzwingt.
 * Läuft bereits ein Durchlauf, wird dieser zurückgegeben – dadurch ist die
 * Funktion aus jedem Auslöser (Start, `online`, Sichtbarkeit, Intervall,
 * neuer Punkt) bedenkenlos aufrufbar.
 */
export function flushTrackBuffer(commit: CommitPoints, options: FlushOptions = {}): Promise<FlushResult> {
  if (running) return running;
  running = drain(commit, options).finally(() => {
    running = null;
  });
  return running;
}

/** true, solange ein Durchlauf offen ist (offline: bis zur Rückkehr des Netzes). */
export function isFlushing(): boolean {
  return running !== null;
}

async function drain(commit: CommitPoints, { skip }: FlushOptions): Promise<FlushResult> {
  const result: FlushResult = { uploaded: 0, dropped: 0, interrupted: false };

  for (;;) {
    const queued = await readQueuedPoints(UPLOAD_BATCH_SIZE);
    if (queued.length === 0) return result;

    const entries = skip ? queued.filter((entry) => !skip(entry)) : queued;
    // Nur übersprungene Punkte in der Runde: Die sind gerade unterwegs, hier
    // gibt es nichts zu tun – der nächste Anstoß nimmt sie, falls nötig.
    if (entries.length === 0) {
      result.interrupted = true;
      return result;
    }

    const before = result.uploaded + result.dropped;
    await commitSplitting(commit, entries, result);
    if (result.interrupted) return result;
    // Kein Fortschritt trotz vorhandener Punkte: lieber abbrechen als endlos
    // dieselbe Runde drehen.
    if (result.uploaded + result.dropped === before) {
      result.interrupted = true;
      return result;
    }
  }
}

/**
 * Schreibt einen Stapel und halbiert ihn bei Fehlern.
 *
 * Der Server sagt beim Batch nicht, welcher Punkt ihm nicht gefiel. Statt
 * jeden Punkt einzeln zu schreiben (tausende Roundtrips) wird nur im
 * Fehlerfall geteilt: Der schlechte Punkt fällt so in wenigen Schritten
 * heraus, der Rest der Fahrt geht durch.
 */
async function commitSplitting(
  commit: CommitPoints,
  entries: BufferedPoint[],
  result: FlushResult
): Promise<void> {
  if (entries.length === 0 || result.interrupted) return;

  try {
    await commit(entries);
    await removeQueuedPoints(entries.map((entry) => entry.id));
    for (const entry of entries) attempts.delete(entry.id);
    result.uploaded += entries.length;
    return;
  } catch (err) {
    if (entries.length > 1) {
      const middle = Math.ceil(entries.length / 2);
      await commitSplitting(commit, entries.slice(0, middle), result);
      await commitSplitting(commit, entries.slice(middle), result);
      return;
    }

    const [entry] = entries;
    const tries = (attempts.get(entry.id) ?? 0) + 1;
    attempts.set(entry.id, tries);

    if (isPermanent(err) && tries >= MAX_ATTEMPTS_PER_POINT) {
      console.error('Trackpunkt wird dauerhaft abgelehnt und verworfen:', entry.id, err);
      await removeQueuedPoints([entry.id]);
      attempts.delete(entry.id);
      result.dropped += 1;
      return;
    }

    // Alles andere ist Verbindung oder Zufall: stehen lassen, später erneut.
    result.interrupted = true;
  }
}

/** Nur für Tests: vergisst laufende Durchläufe und Fehlversuche. */
export function __resetTrackUploaderForTests(): void {
  running = null;
  attempts.clear();
}
