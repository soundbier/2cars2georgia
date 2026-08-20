import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTileUrl,
  clearOfflineTiles,
  downloadCells,
  DownloadProgress,
  offlineTilesSupported,
  readCachedTile,
  readOfflineAreas,
  resetOfflineAreasCache,
  TILE_CACHE_NAME
} from './offlineTiles';
import { estimateTileCountPerCell, GRID_ZOOM, tileKey } from './tileGrid';

/**
 * Kleine Cache-Storage-Attrappe: jsdom bringt keine mit, und die echte
 * Implementierung ist für diese Tests auch gar nicht nötig – es zählt, dass
 * unter der angeforderten URL etwas abgelegt und wiedergefunden wird.
 */
class FakeCache {
  entries = new Map<string, Response>();

  async match(url: string): Promise<Response | undefined> {
    return this.entries.get(url);
  }

  async put(url: string, response: Response): Promise<void> {
    this.entries.set(url, response);
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

const OSM = { id: 'osm', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' };
const CELL = { z: GRID_ZOOM, x: 549, y: 358 };

let storage: FakeCacheStorage;

beforeEach(() => {
  storage = new FakeCacheStorage();
  vi.stubGlobal('caches', storage);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('tile', { status: 200 }))
  );
  resetOfflineAreasCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetOfflineAreasCache();
});

describe('buildTileUrl', () => {
  it('setzt Zoom, Spalte, Zeile und eine feste Subdomain ein', () => {
    expect(buildTileUrl(OSM.url, { z: 10, x: 549, y: 358 })).toBe(
      'https://a.tile.openstreetmap.org/10/549/358.png'
    );
  });

  it('lässt das Retina-Suffix leer, genau wie Leaflet ohne detectRetina', () => {
    expect(
      buildTileUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        z: 6,
        x: 34,
        y: 22
      })
    ).toBe('https://a.basemaps.cartocdn.com/light_all/6/34/22.png');
  });
});

describe('offlineTilesSupported', () => {
  it('erkennt einen Browser ohne Cache Storage', () => {
    vi.unstubAllGlobals();
    expect(offlineTilesSupported()).toBe(false);
  });
});

describe('downloadCells', () => {
  it('lädt alle Kacheln des Feldes und meldet den Fortschritt', async () => {
    const progress: DownloadProgress[] = [];
    const expected = estimateTileCountPerCell();

    const result = await downloadCells([CELL], [OSM], { onProgress: (p) => progress.push(p) });

    expect(result.total).toBe(expected);
    expect(result.completed).toBe(expected);
    expect(result.failed).toBe(0);
    expect(result.aborted).toBe(false);
    expect(progress[progress.length - 1].completed).toBe(expected);
    expect(storage.caches.get(TILE_CACHE_NAME)?.entries.size).toBe(expected);
  });

  it('macht die geladenen Kacheln ohne Netz verfügbar', async () => {
    await downloadCells([CELL], [OSM]);

    // Offline: jeder Netzzugriff schlägt jetzt fehl.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));

    const cached = await readCachedTile(buildTileUrl(OSM.url, CELL));
    expect(cached).toBeDefined();
    expect(await cached!.text()).toBe('tile');
  });

  it('vermerkt geladene Felder samt Ebenen im Bestand', async () => {
    const seamarks = { id: 'seamarks', url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png' };
    await downloadCells([CELL], [OSM, seamarks]);

    const areas = readOfflineAreas();
    const area = areas[tileKey(CELL)];
    expect(area).toBeDefined();
    expect(area.layers).toEqual(['osm', 'seamarks']);
    expect(area.tileCount).toBe(estimateTileCountPerCell() * 2);
  });

  it('überspringt bereits gespeicherte Kacheln beim zweiten Lauf', async () => {
    await downloadCells([CELL], [OSM]);
    const callsAfterFirst = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    const result = await downloadCells([CELL], [OSM]);

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);
    expect(result.completed).toBe(result.total);
    expect(result.failed).toBe(0);
  });

  it('bricht bei Netzwerkfehlern nicht ab, sondern zählt sie', async () => {
    // Die Übersichtskachel der Zoomstufe 6 ist dauerhaft nicht zu bekommen.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/6/')) throw new Error('network down');
        return new Response('tile', { status: 200 });
      })
    );

    const result = await downloadCells([CELL], [OSM]);

    expect(result.failed).toBe(1);
    expect(result.completed).toBe(result.total);
    expect(readOfflineAreas()[tileKey(CELL)]).toBeDefined();
  });

  it('versucht es ohne CORS erneut, wenn der Dienst keine Header schickt', async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.mode !== 'no-cors') throw new TypeError('CORS blocked');
      // Opake Antwort: nicht lesbar (ok === false), aber als Bildquelle
      // brauchbar – genau wie sie ein Browser bei mode 'no-cors' liefert.
      const opaque = { ok: false, type: 'opaque', clone: () => opaque };
      return opaque as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await downloadCells([CELL], [OSM]);

    expect(result.failed).toBe(0);
    expect(storage.caches.get(TILE_CACHE_NAME)?.entries.size).toBe(result.total);
  });

  it('vermerkt einen abgebrochenen Download nicht als geladenes Feld', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        return new Response('tile', { status: 200 });
      })
    );

    const result = await downloadCells([CELL], [OSM], { signal: controller.signal });

    expect(result.aborted).toBe(true);
    expect(result.completed).toBeLessThan(result.total);
    expect(readOfflineAreas()[tileKey(CELL)]).toBeUndefined();
  });

  it('ohne Cache Storage schlägt der Download sauber fehl statt zu werfen', async () => {
    vi.unstubAllGlobals();
    const result = await downloadCells([CELL], [OSM]);
    expect(result.failed).toBe(result.total);
    expect(result.completed).toBe(0);
  });
});

describe('clearOfflineTiles', () => {
  it('leert Kachelspeicher und Bestand', async () => {
    await downloadCells([CELL], [OSM]);
    expect(Object.keys(readOfflineAreas())).toHaveLength(1);

    await clearOfflineTiles();

    expect(Object.keys(readOfflineAreas())).toHaveLength(0);
    expect(storage.caches.has(TILE_CACHE_NAME)).toBe(false);
    expect(await readCachedTile(buildTileUrl(OSM.url, CELL))).toBeUndefined();
  });
});
