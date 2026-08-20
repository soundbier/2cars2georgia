import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PlannedRouteLine, RouteEditorLayer, useActivePlannedRoute, useRouteEditor } from './RoutePlanner';
import { useOfflineDownload } from './OfflineMapDownload';
import {
  createRoute,
  findRoute,
  readPlannedRoutes,
  resetPlannedRoutesCache,
  setActiveRoute
} from '../lib/plannedRoute';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { GRID_ZOOM, pointToTile, tileKey } from '../lib/tileGrid';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  resetPlannedRoutesCache();
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
  resetPlannedRoutesCache();
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

function renderEditor(routeId: string, active: boolean) {
  let map: L.Map | null = null;
  const editor = { current: null as ReturnType<typeof useRouteEditor> | null };

  function Harness() {
    const state = useRouteEditor(routeId);
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
    const route = createRoute('Tag 1', '2026-05-04');
    const { container, clickMap } = renderEditor(route.id, true);

    clickMap(PASSAU);
    clickMap(LINZ);

    await waitFor(() => {
      const points = [...container.querySelectorAll('.route-waypoint')];
      expect(points.map((el) => el.textContent)).toEqual(['1', '2']);
    });

    // Die Verbindungslinie liegt zwischen den Punkten.
    expect(container.querySelectorAll('path.leaflet-interactive').length).toBeGreaterThan(0);
    expect(findRoute(readPlannedRoutes(), route.id)?.waypoints).toHaveLength(2);
  });

  it('nimmt außerhalb des Planungsmodus keine Klicks an', () => {
    const route = createRoute('Tag 1', '');
    const { container, clickMap } = renderEditor(route.id, false);

    clickMap(PASSAU);

    expect(findRoute(readPlannedRoutes(), route.id)?.waypoints).toHaveLength(0);
    expect(container.querySelectorAll('.route-waypoint')).toHaveLength(0);
  });

  it('verschiebt, entfernt und löscht Wegpunkte einer Route', () => {
    const route = createRoute('Tag 1', '');
    const { result } = renderHook(() => useRouteEditor(route.id));

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
    expect(findRoute(readPlannedRoutes(), route.id)?.waypoints).toHaveLength(0);
  });

  it('hält die Routen getrennt und zeigt nur die aktive an', () => {
    const day1 = createRoute('Tag 1', '2026-05-04');
    const day2 = createRoute('Tag 2', '2026-05-05');

    const { result } = renderHook(
      () => ({
        first: useRouteEditor(day1.id),
        second: useRouteEditor(day2.id),
        active: useActivePlannedRoute()
      }),
      { wrapper: Wrapper }
    );

    act(() => result.current.first.addAt(PASSAU.lat, PASSAU.lng));
    act(() => result.current.second.addAt(LINZ.lat, LINZ.lng));

    expect(result.current.first.waypoints).toHaveLength(1);
    expect(result.current.second.waypoints).toHaveLength(1);
    expect(result.current.first.waypoints[0].lat).toBeCloseTo(PASSAU.lat);

    // Zuletzt angelegte Route ist aktiv; umschalten wechselt die Anzeige.
    expect(result.current.active?.id).toBe(day2.id);
    act(() => setActiveRoute(day1.id));
    expect(result.current.active?.id).toBe(day1.id);
    expect(result.current.active?.waypoints[0].lng).toBeCloseTo(PASSAU.lng);
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
    const route = createRoute('Tag 1', '');
    const { result } = renderHook(() => {
      const editor = useRouteEditor(route.id);
      const active = useActivePlannedRoute();
      const offline = useOfflineDownload(active?.waypoints ?? [], layers);
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
