import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MapContainer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { OfflineTileLayer } from './OfflineTileLayer';
import { buildTileUrl, TILE_CACHE_NAME } from '../lib/offlineTiles';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ROUTE: [number, number][] = [
  [48.5667, 13.4319],
  [48.3069, 14.2858],
  [48.2082, 16.3738]
];

/** Cache-Storage-Attrappe, die nur die abgelegten Antworten wiedergibt. */
function fakeCaches(entries: Map<string, Response>) {
  return {
    open: async () => ({
      match: async (url: string) => entries.get(url),
      put: async (url: string, response: Response) => void entries.set(url, response)
    }),
    delete: async () => true
  };
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  // Leaflet lädt nur Kacheln, wenn der Container eine Größe hat – in jsdom ist
  // die immer 0.
  for (const [prop, value] of [
    ['clientWidth', 800],
    ['clientHeight', 600],
    ['offsetWidth', 800],
    ['offsetHeight', 600]
  ] as const) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value });
    sizeSpies.push(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
    });
  }

  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:tile', revokeObjectURL: () => {} }));
});

afterEach(() => {
  for (const restore of sizeSpies) restore();
  sizeSpies = [];
  vi.unstubAllGlobals();
  setOnline(true);
});

function renderMap() {
  return render(
    // Renderer explizit: jsdom meldet weder SVG- noch Canvas-Unterstützung,
    // Leaflet wählte sonst gar keinen und könnte die Route nicht zeichnen.
    <MapContainer center={[48.2082, 16.3738]} zoom={10} renderer={new L.SVG()}>
      <OfflineTileLayer url={TILE_URL} attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
      <Polyline positions={ROUTE} pathOptions={{ color: '#bc4f27' }} />
      <Marker position={ROUTE[2]} />
    </MapContainer>
  );
}

describe('OfflineTileLayer', () => {
  it('zeigt online weiterhin die Kacheln des Kachelservers', async () => {
    setOnline(true);
    vi.stubGlobal('caches', fakeCaches(new Map()));

    const { container } = renderMap();

    await waitFor(() => {
      const tiles = [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
      expect(tiles.length).toBeGreaterThan(0);
      expect(tiles.some((tile) => tile.src.includes('tile.openstreetmap.org'))).toBe(true);
    });
  });

  it('nimmt offline die gespeicherten Kacheln statt des Netzes', async () => {
    setOnline(false);
    // Der Bestand deckt den gesamten Ausschnitt ab – wie nach einem Download
    // der Felder unter der Route.
    const requested: string[] = [];
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async (url: string) => {
          requested.push(url);
          return new Response('tile');
        },
        put: async () => {}
      }),
      delete: async () => true
    });

    const { container } = renderMap();

    await waitFor(() => {
      const tiles = [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
      expect(tiles.length).toBeGreaterThan(0);
      expect(tiles.every((tile) => tile.src === 'blob:tile')).toBe(true);
    });
    expect(container.querySelectorAll('img.offline-tile-missing')).toHaveLength(0);
    // Gesucht wird unter derselben URL, unter der der Download speichert.
    expect(requested).toContain(buildTileUrl(TILE_URL, { z: 10, x: 557, y: 355 }));
  });

  it('markiert offline nicht heruntergeladene Bereiche, statt ins Leere zu laden', async () => {
    setOnline(false);
    const fetchSpy = vi.fn(async () => new Response('tile'));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('caches', fakeCaches(new Map()));

    const { container } = renderMap();

    await waitFor(() => {
      expect(container.querySelectorAll('img.offline-tile-missing').length).toBeGreaterThan(0);
    });
    // Ohne Netz wird gar nicht erst angefragt – keine Fehlerflut in der Konsole.
    expect([...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')].every(
      (tile) => !tile.src.startsWith('http')
    )).toBe(true);
  });

  it('zeigt Route und Marker auch ohne Netz und ohne gespeicherte Kacheln', async () => {
    setOnline(false);
    vi.stubGlobal('caches', fakeCaches(new Map()));

    const { container } = renderMap();

    await waitFor(() => {
      expect(container.querySelector('path.leaflet-interactive')).not.toBeNull();
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
    });
  });

  it('kommt ohne Cache Storage aus (unsicherer Kontext, alter Browser)', async () => {
    setOnline(true);
    vi.stubGlobal('caches', undefined);

    const { container } = renderMap();

    await waitFor(() => {
      const tiles = [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
      expect(tiles.some((tile) => tile.src.includes('tile.openstreetmap.org'))).toBe(true);
    });
  });
});

describe('Kachelspeicher', () => {
  it('benutzt einen eigenen, benannten Cache', () => {
    expect(TILE_CACHE_NAME).toBe('offline-map-tiles-v1');
  });
});
