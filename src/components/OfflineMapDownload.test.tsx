import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOfflineDownload } from './OfflineMapDownload';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { estimateTileCountPerCell, GRID_ZOOM, pointToTile, tileKey } from '../lib/tileGrid';
import { Coordinates } from '../types';

const ROUTE: Coordinates[] = [
  { lat: 48.5667, lng: 13.4319 },
  { lat: 48.3069, lng: 14.2858 },
  { lat: 48.2082, lng: 16.3738 }
];

const LAYERS = [{ id: 'osm', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }];

let stored: Map<string, Response>;

beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => stored.get(url),
      put: async (url: string, response: Response) => void stored.set(url, response)
    }),
    delete: async () => {
      stored.clear();
      return true;
    }
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('tile')));
  resetOfflineAreasCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetOfflineAreasCache();
});

describe('useOfflineDownload', () => {
  it('erzeugt das Raster erst beim Öffnen des Downloadmodus', () => {
    const { result } = renderHook(() => useOfflineDownload(ROUTE, LAYERS));

    expect(result.current.active).toBe(false);
    expect(result.current.cells).toHaveLength(0);

    act(() => result.current.open());

    expect(result.current.active).toBe(true);
    expect(result.current.cells.length).toBeGreaterThan(1);
    // Die Route liegt im Raster.
    const keys = result.current.cells.map((cell) => cell.key);
    expect(keys).toContain(tileKey(pointToTile(ROUTE[0], GRID_ZOOM)));
  });

  it('lädt nur die ausgewählten Felder', async () => {
    const { result } = renderHook(() => useOfflineDownload(ROUTE, LAYERS));
    act(() => result.current.open());

    const first = result.current.cells[0].key;
    act(() => result.current.toggleCell(first));
    expect(result.current.selected.has(first)).toBe(true);
    expect(result.current.selectedTiles).toBe(estimateTileCountPerCell());

    await act(async () => {
      await result.current.start();
    });

    // Genau ein Feld – nicht das ganze Raster.
    expect(stored.size).toBe(estimateTileCountPerCell());
    await waitFor(() => expect(result.current.downloaded.has(first)).toBe(true));
    // Nach dem Download ist die Auswahl leer, das Feld gilt als vorhanden.
    expect(result.current.selected.size).toBe(0);
  });

  it('meldet das Ergebnis und löscht den Bestand wieder', async () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() => useOfflineDownload(ROUTE, LAYERS, onFinished));
    act(() => result.current.open());
    act(() => result.current.selectAll());

    const selectedCount = result.current.selected.size;
    expect(selectedCount).toBe(result.current.cells.length);

    await act(async () => {
      await result.current.start();
    });

    expect(onFinished).toHaveBeenCalledWith({ failed: 0, aborted: false });
    await waitFor(() => expect(result.current.storedAreas).toBe(selectedCount));

    await act(async () => {
      await result.current.removeAll();
    });

    await waitFor(() => expect(result.current.storedAreas).toBe(0));
    expect(stored.size).toBe(0);
  });

  it('startet ohne Auswahl keinen Download', async () => {
    const { result } = renderHook(() => useOfflineDownload(ROUTE, LAYERS));
    act(() => result.current.open());

    await act(async () => {
      await result.current.start();
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.storedAreas).toBe(0);
  });
});
