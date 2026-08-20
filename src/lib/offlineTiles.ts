/**
 * Offline-Kartenkacheln: Speicher, Download und Bestandsverzeichnis.
 *
 * Kacheln liegen in der Cache Storage des Browsers, abgelegt unter genau der
 * URL, unter der die Karte sie auch online anfordert. Damit kann die
 * Kartenebene sie ohne Umrechnung wiederfinden, und der Speicher wächst nicht
 * doppelt neben dem HTTP-Cache. IndexedDB wäre die Alternative gewesen –
 * Cache Storage speichert hier aber genau das Richtige (fertige HTTP-Antworten
 * inkl. Bild-Bytes) und kommt ohne eigenes Schema aus.
 *
 * Welche Rasterfelder geladen sind, steht daneben in localStorage: Es sind
 * wenige hundert Byte pro Gerät, sie gehören keinem Roadtrip und müssen ohne
 * Netz sofort lesbar sein. Firestore ist dafür bewusst nicht zuständig.
 */

import { TileCoords, tileKey, tilesForCells, AVERAGE_TILE_BYTES } from './tileGrid';

export const TILE_CACHE_NAME = 'offline-map-tiles-v1';

const STORAGE_KEY = 'boat_offline_tiles';

/** Gleichzeitige Downloads – genug Durchsatz, ohne den Kachelserver zu fluten. */
const DOWNLOAD_CONCURRENCY = 4;

/**
 * Feste Subdomain für alle Kachel-URLs.
 *
 * Leaflet verteilt Anfragen sonst über a/b/c. Beim Download stünde die Kachel
 * dann unter einer anderen URL im Cache als die, die die Karte später
 * anfordert – der Treffer bliebe aus. Über HTTP/2 kostet die eine Domain
 * nichts an Geschwindigkeit.
 */
export const TILE_SUBDOMAIN = 'a';

/** Ebene, die offline verfügbar sein soll (Grundkarte oder Overlay). */
export interface OfflineLayer {
  id: string;
  url: string;
}

/** Ein heruntergeladenes Rasterfeld. */
export interface OfflineArea {
  key: string;
  z: number;
  x: number;
  y: number;
  /** Ebenen, die für dieses Feld geladen wurden. */
  layers: string[];
  tileCount: number;
  downloadedAt: number;
}

interface OfflineStore {
  version: 1;
  areas: Record<string, OfflineArea>;
}

const EMPTY_STORE: OfflineStore = { version: 1, areas: {} };

let cachedStore: OfflineStore | null = null;
const listeners = new Set<() => void>();

function readStore(): OfflineStore {
  if (cachedStore) return cachedStore;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<OfflineStore>) : null;
    cachedStore =
      parsed && parsed.areas && typeof parsed.areas === 'object'
        ? { version: 1, areas: parsed.areas as Record<string, OfflineArea> }
        : EMPTY_STORE;
  } catch (err) {
    console.error('Offline-Kartenbestand konnte nicht gelesen werden:', err);
    cachedStore = EMPTY_STORE;
  }
  return cachedStore;
}

function writeStore(next: OfflineStore): void {
  cachedStore = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Offline-Kartenbestand konnte nicht gespeichert werden:', err);
  }
  for (const listener of listeners) listener();
}

/** Alle offline verfügbaren Rasterfelder, nach Feldschlüssel. */
export function readOfflineAreas(): Record<string, OfflineArea> {
  return readStore().areas;
}

/** Benachrichtigt bei jeder Änderung am Bestand (Download, Löschen). */
export function subscribeOfflineAreas(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nur für Tests: gelesenen Bestand vergessen. */
export function resetOfflineAreasCache(): void {
  cachedStore = null;
}

/**
 * Kachel-URL aus einer Leaflet-Vorlage.
 *
 * Deckt dieselben Platzhalter ab, die die Ebenen in lib/mapLayers verwenden:
 * `{s}` (Subdomain, hier fest), `{r}` (Retina-Suffix, das Leaflet ohne
 * `detectRetina` ebenfalls leer lässt) sowie `{z}/{x}/{y}`.
 */
export function buildTileUrl(template: string, { z, x, y }: TileCoords): string {
  return template
    .replace('{s}', TILE_SUBDOMAIN)
    .replace('{r}', '')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function cacheStorage(): CacheStorage | null {
  // Fehlt im unsicheren Kontext (http ohne localhost) und in älteren Browsern.
  return typeof caches !== 'undefined' ? caches : null;
}

/** true, wenn der Browser Offline-Karten überhaupt speichern kann. */
export function offlineTilesSupported(): boolean {
  return cacheStorage() !== null;
}

async function openTileCache(): Promise<Cache | null> {
  const storage = cacheStorage();
  if (!storage) return null;
  try {
    return await storage.open(TILE_CACHE_NAME);
  } catch (err) {
    console.error('Kachelspeicher konnte nicht geöffnet werden:', err);
    return null;
  }
}

/** Gespeicherte Kachel, oder undefined wenn sie nicht offline vorliegt. */
export async function readCachedTile(url: string): Promise<Response | undefined> {
  const cache = await openTileCache();
  if (!cache) return undefined;
  try {
    return await cache.match(url);
  } catch (err) {
    console.error('Kachel konnte nicht gelesen werden:', err);
    return undefined;
  }
}

export interface DownloadProgress {
  /** Zu ladende Kacheln insgesamt (bereits vorhandene eingeschlossen). */
  total: number;
  /** Fertig – geladen oder schon vorhanden. */
  completed: number;
  /** Kacheln, die der Server nicht geliefert hat. */
  failed: number;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface DownloadResult extends DownloadProgress {
  /** true, wenn der Download vorzeitig abgebrochen wurde. */
  aborted: boolean;
}

/** Grobe Abschätzung der Downloadmenge in Byte. */
export function estimateBytes(tileCount: number): number {
  return tileCount * AVERAGE_TILE_BYTES;
}

/**
 * Lädt die Kacheln der gewählten Felder für alle aktiven Ebenen.
 *
 * Bereits gespeicherte Kacheln werden übersprungen – ein zweiter Durchlauf
 * über dieselbe Strecke lädt also nur die Lücken nach. Fehlschläge brechen den
 * Lauf nicht ab: Unterwegs ist eine wacklige Verbindung der Normalfall, und
 * ein Feld mit 340 von 345 Kacheln ist immer noch nützlich.
 */
export async function downloadCells(
  cells: TileCoords[],
  layers: OfflineLayer[],
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const cache = await openTileCache();
  const tiles = tilesForCells(cells);
  const jobs: string[] = [];
  for (const layer of layers) {
    for (const tile of tiles) jobs.push(buildTileUrl(layer.url, tile));
  }

  const progress: DownloadProgress = { total: jobs.length, completed: 0, failed: 0 };
  if (!cache) {
    return { ...progress, failed: jobs.length, completed: 0, aborted: false };
  }

  options.onProgress?.({ ...progress });

  let next = 0;
  let aborted = false;

  const worker = async () => {
    while (next < jobs.length) {
      if (options.signal?.aborted) {
        aborted = true;
        return;
      }
      const url = jobs[next++];
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetchTile(url, options.signal);
          // Auch opaque Antworten (status 0) sind brauchbar: Der Browser kann
          // sie zwar nicht lesen, als <img>-Quelle funktionieren sie.
          if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(url, response.clone());
          } else progress.failed++;
        }
        progress.completed++;
      } catch (err) {
        if (options.signal?.aborted) {
          aborted = true;
          return;
        }
        progress.failed++;
        progress.completed++;
      }
      options.onProgress?.({ ...progress });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, jobs.length) }, () => worker())
  );

  if (!aborted && !options.signal?.aborted) {
    markAreasDownloaded(cells, layers, tiles.length / Math.max(1, cells.length));
  }

  return { ...progress, aborted: aborted || Boolean(options.signal?.aborted) };
}

/**
 * Kachel laden, notfalls ohne CORS.
 *
 * Die Kachelserver dieser App liefern CORS-Header – aber nicht jeder Dienst
 * tut das zuverlässig, und ohne den zweiten Versuch wäre eine ganze Ebene
 * offline schlicht leer. Die opake Antwort lässt sich zwar nicht auslesen,
 * als Bildquelle reicht sie.
 */
async function fetchTile(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const response = await fetch(url, { signal });
    if (response.ok) return response;
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  return fetch(url, { signal, mode: 'no-cors' }).catch((err) => {
    if (signal?.aborted) throw err;
    return null;
  });
}

function markAreasDownloaded(cells: TileCoords[], layers: OfflineLayer[], tilesPerCell: number): void {
  const store = readStore();
  const areas = { ...store.areas };
  const layerIds = layers.map((layer) => layer.id);

  for (const cell of cells) {
    const key = tileKey(cell);
    const previous = areas[key];
    areas[key] = {
      key,
      z: cell.z,
      x: cell.x,
      y: cell.y,
      // Ebenen sammeln statt ersetzen: Wer später ein Overlay dazuschaltet und
      // erneut lädt, verliert die schon geladene Grundkarte nicht aus dem
      // Verzeichnis.
      layers: [...new Set([...(previous?.layers ?? []), ...layerIds])],
      tileCount: Math.round(tilesPerCell * layerIds.length),
      downloadedAt: Date.now()
    };
  }

  writeStore({ version: 1, areas });
}

/** Löscht alle gespeicherten Kacheln und das Verzeichnis dazu. */
export async function clearOfflineTiles(): Promise<void> {
  const storage = cacheStorage();
  if (storage) {
    try {
      await storage.delete(TILE_CACHE_NAME);
    } catch (err) {
      console.error('Kachelspeicher konnte nicht geleert werden:', err);
    }
  }
  writeStore({ version: 1, areas: {} });
}
