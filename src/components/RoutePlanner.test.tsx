import { ReactNode, useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PlannedRouteLine, RouteEditorLayer, useRouteEditor } from './RoutePlanner';
import { useOfflineDownload } from './OfflineMapDownload';
import { PlannedWaypoint } from '../lib/plannedRoute';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { GRID_ZOOM, pointToTile, tileKey } from '../lib/tileGrid';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  resetOfflineAreasCache();

  // Wie im Kachel-Test: In jsdom hat der Kartencontainer sonst keine Größe.
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
});

afterEach(() => {
  for (const restore of sizeSpies) restore();
  sizeSpies = [];
  localStorage.clear();
  resetOfflineAreasCache();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>{children}</I18nProvider>
    </PreferencesProvider>
  );
}

/** Gibt die Leaflet-Karte nach außen, damit der Test auf sie klicken kann. */
function ExposeMap({ onReady }: { onReady: (map: L.Map) => void }) {
  onReady(useMap());
  return null;
}

/**
 * Ersetzt im Test, was auf der Planerseite der Firestore-Hook tut: die
 * Wegpunkte halten und jede Änderung entgegennehmen.
 */
function useStoredWaypoints() {
  const [waypoints, setWaypoints] = useState<PlannedWaypoint[]>([]);
  const onChange = useCallback((next: PlannedWaypoint[]) => setWaypoints(next), []);
  return { waypoints, onChange };
}

function renderEditor(active: boolean) {
  let map: L.Map | null = null;
  const editor = { current: null as ReturnType<typeof useRouteEditor> | null };

  function Harness() {
    const stored = useStoredWaypoints();
    const state = useRouteEditor(stored.waypoints, stored.onChange);
    editor.current = state;
    return (
      // Renderer explizit: jsdom meldet weder SVG- noch Canvas-Unterstützung.
      <MapContainer center={[48.4, 13.9]} zoom={9} renderer={new L.SVG()}>
        <ExposeMap onReady={(instance) => (map = instance)} />
        <RouteEditorLayer
          active={active}
          waypoints={state.waypoints}
          onAdd={state.addAt}
          onMove={state.moveTo}
          onRemove={state.remove}
        />
      </MapContainer>
    );
  }

  const utils = render(<Harness />, { wrapper: Wrapper });
  return {
    ...utils,
    editor,
    clickMap: (point: typeof PASSAU) => {
      act(() => {
        map?.fireEvent('click', { latlng: L.latLng(point.lat, point.lng) });
      });
    }
  };
}

describe('Routenplanung', () => {
  it('setzt bei einem Kartenklick einen nummerierten Wegpunkt', async () => {
    const { container, clickMap, editor } = renderEditor(true);

    clickMap(PASSAU);
    clickMap(LINZ);

    await waitFor(() => {
      const points = [...container.querySelectorAll('.route-waypoint')];
      expect(points.map((el) => el.textContent)).toEqual(['1', '2']);
    });

    // Die Verbindungslinie liegt zwischen den Punkten.
    expect(container.querySelectorAll('path.leaflet-interactive').length).toBeGreaterThan(0);
    expect(editor.current?.waypoints).toHaveLength(2);
  });

  it('nimmt außerhalb des Planungsmodus keine Klicks an', () => {
    const { container, clickMap, editor } = renderEditor(false);

    clickMap(PASSAU);

    expect(editor.current?.waypoints).toHaveLength(0);
    expect(container.querySelectorAll('.route-waypoint')).toHaveLength(0);
  });

  it('verschiebt, entfernt und löscht Wegpunkte einer Route', () => {
    const { result } = renderHook(() => {
      const stored = useStoredWaypoints();
      return useRouteEditor(stored.waypoints, stored.onChange);
    });

    act(() => result.current.addAt(PASSAU.lat, PASSAU.lng));
    act(() => result.current.addAt(LINZ.lat, LINZ.lng));
    const [first, second] = result.current.waypoints;

    act(() => result.current.moveTo(first.id, 48.6, 13.5));
    expect(result.current.waypoints[0]).toMatchObject({ id: first.id, lat: 48.6, lng: 13.5 });
    expect(result.current.lengthMeters).toBeGreaterThan(0);

    act(() => result.current.remove(second.id));
    expect(result.current.waypoints.map((p) => p.id)).toEqual([first.id]);

    act(() => result.current.addAt(LINZ.lat, LINZ.lng));
    act(() => result.current.undo());
    expect(result.current.waypoints.map((p) => p.id)).toEqual([first.id]);

    act(() => result.current.clear());
    expect(result.current.waypoints).toHaveLength(0);
  });

  it('zeichnet eine geplante Route auch ohne Bearbeitung', () => {
    const { container } = render(
      <MapContainer center={[48.4, 13.9]} zoom={9} renderer={new L.SVG()}>
        <PlannedRouteLine
          waypoints={[
            { id: 'a', ...PASSAU },
            { id: 'b', ...LINZ }
          ]}
        />
      </MapContainer>,
      { wrapper: Wrapper }
    );

    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.route-waypoint')).toHaveLength(0);
  });

  it('erzeugt das Downloadraster aus der abgesteckten Route', () => {
    const layers = [{ id: 'osm', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }];
    const { result } = renderHook(() => {
      const stored = useStoredWaypoints();
      const editor = useRouteEditor(stored.waypoints, stored.onChange);
      const offline = useOfflineDownload(editor.waypoints, layers);
      return { editor, offline };
    });

    act(() => result.current.editor.addAt(PASSAU.lat, PASSAU.lng));
    act(() => result.current.editor.addAt(LINZ.lat, LINZ.lng));
    act(() => result.current.offline.open());

    const keys = result.current.offline.cells.map((cell) => cell.key);
    expect(keys).toContain(tileKey(pointToTile(PASSAU, GRID_ZOOM)));
    expect(keys).toContain(tileKey(pointToTile(LINZ, GRID_ZOOM)));
    // Ein Korridor entlang der Strecke, kein Rechteck über halb Europa.
    expect(keys.length).toBeLessThan(220);
  });
});
