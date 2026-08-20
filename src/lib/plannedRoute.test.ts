import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRoute,
  createWaypoint,
  deleteRoute,
  duplicateRoute,
  findRoute,
  plannedRouteLengthMeters,
  readPlannedRoutes,
  renameRoute,
  resetPlannedRoutesCache,
  setActiveRoute,
  setRouteWaypoints,
  sortRoutes,
  subscribePlannedRoutes
} from './plannedRoute';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const WIEN = { lat: 48.2082, lng: 16.3738 };

beforeEach(() => {
  localStorage.clear();
  resetPlannedRoutesCache();
});

afterEach(() => {
  localStorage.clear();
  resetPlannedRoutesCache();
});

describe('plannedRoute', () => {
  it('startet ohne Routen', () => {
    expect(readPlannedRoutes()).toEqual({ routes: [], activeId: null });
  });

  it('legt eine Route an, steckt sie ab und behält sie über einen Neustart', () => {
    const route = createRoute('Tag 1: Passau – Wien', '2026-05-04');
    setRouteWaypoints(route.id, [createWaypoint(PASSAU.lat, PASSAU.lng), createWaypoint(WIEN.lat, WIEN.lng)]);

    resetPlannedRoutesCache();
    const store = readPlannedRoutes();
    const stored = findRoute(store, route.id);

    expect(store.routes).toHaveLength(1);
    expect(store.activeId).toBe(route.id);
    expect(stored?.name).toBe('Tag 1: Passau – Wien');
    expect(stored?.date).toBe('2026-05-04');
    expect(stored?.waypoints).toHaveLength(2);
    expect(stored?.waypoints[1].lng).toBeCloseTo(WIEN.lng);
  });

  it('benennt um, aktiviert und löscht einzelne Routen', () => {
    const first = createRoute('Tag 1', '2026-05-04');
    const second = createRoute('Tag 2', '2026-05-05');

    renameRoute(first.id, 'Tag 1: Anreise', '2026-05-03');
    expect(findRoute(readPlannedRoutes(), first.id)).toMatchObject({
      name: 'Tag 1: Anreise',
      date: '2026-05-03'
    });

    // Zuletzt angelegte Route ist aktiv, umschalten geht auf jede andere.
    expect(readPlannedRoutes().activeId).toBe(second.id);
    setActiveRoute(first.id);
    expect(readPlannedRoutes().activeId).toBe(first.id);

    // Wird die aktive Route gelöscht, gilt wieder der gefahrene Track.
    deleteRoute(first.id);
    const store = readPlannedRoutes();
    expect(store.routes.map((route) => route.id)).toEqual([second.id]);
    expect(store.activeId).toBeNull();
  });

  it('kopiert eine Route mit eigenen Wegpunkten', () => {
    const source = createRoute('Tag 1', '2026-05-04');
    setRouteWaypoints(source.id, [createWaypoint(PASSAU.lat, PASSAU.lng)]);

    const copy = duplicateRoute(source.id, 'Tag 1 (Kopie)');
    const store = readPlannedRoutes();

    expect(copy).not.toBeNull();
    expect(store.activeId).toBe(copy?.id);
    expect(copy?.date).toBe('');
    expect(copy?.waypoints[0]).toMatchObject({ lat: PASSAU.lat, lng: PASSAU.lng });
    // Eigene Kennungen: sonst würde das Verschieben beide Routen ändern.
    expect(copy?.waypoints[0].id).not.toBe(findRoute(store, source.id)?.waypoints[0].id);
  });

  it('meldet Änderungen an die Oberfläche', () => {
    let calls = 0;
    const unsubscribe = subscribePlannedRoutes(() => {
      calls += 1;
    });

    const route = createRoute('Tag 1', '');
    expect(calls).toBe(1);

    unsubscribe();
    deleteRoute(route.id);
    expect(calls).toBe(1);
  });

  it('übernimmt die Route der ersten Fassung', () => {
    localStorage.setItem(
      'boat_planned_route',
      JSON.stringify([
        { id: 'a', lat: PASSAU.lat, lng: PASSAU.lng },
        { id: 'b', lat: WIEN.lat, lng: WIEN.lng }
      ])
    );

    const store = readPlannedRoutes();

    expect(store.routes).toHaveLength(1);
    expect(store.routes[0].waypoints).toHaveLength(2);
    expect(store.activeId).toBe(store.routes[0].id);
    // Der alte Schlüssel wird dabei aufgeräumt, sonst käme die Route bei
    // jedem Leeren der Liste zurück.
    expect(localStorage.getItem('boat_planned_route')).toBeNull();
  });

  it('überspringt unbrauchbare Einträge im Speicher', () => {
    localStorage.setItem(
      'boat_planned_routes',
      JSON.stringify({
        routes: [
          {
            id: 'r1',
            name: 'Tag 1',
            date: '',
            waypoints: [{ id: 'a', lat: 48, lng: 13 }, { id: 'b', lat: 'nein' }, null],
            updatedAt: 1
          },
          null
        ],
        activeId: 'gibt-es-nicht'
      })
    );

    const store = readPlannedRoutes();

    expect(store.routes).toHaveLength(1);
    expect(store.routes[0].waypoints).toEqual([{ id: 'a', lat: 48, lng: 13 }]);
    expect(store.activeId).toBeNull();
  });

  it('sortiert Routen nach Tag, danach nach letzter Änderung', () => {
    const routes = [
      { id: 'c', name: 'ohne Tag, alt', date: '', waypoints: [], updatedAt: 10 },
      { id: 'b', name: 'Tag 2', date: '2026-05-05', waypoints: [], updatedAt: 5 },
      { id: 'd', name: 'ohne Tag, neu', date: '', waypoints: [], updatedAt: 20 },
      { id: 'a', name: 'Tag 1', date: '2026-05-04', waypoints: [], updatedAt: 1 }
    ];

    expect(sortRoutes(routes).map((route) => route.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('rechnet die Länge der geplanten Route', () => {
    // Passau → Wien, gut 250 km Luftlinie.
    const meters = plannedRouteLengthMeters([PASSAU, WIEN]);

    expect(meters / 1000).toBeGreaterThan(200);
    expect(meters / 1000).toBeLessThan(260);
    expect(plannedRouteLengthMeters([PASSAU])).toBe(0);
  });
});
