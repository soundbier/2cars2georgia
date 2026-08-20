import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWaypoint,
  findRoute,
  PlannedRoute,
  plannedRouteLengthMeters,
  readActiveRouteId,
  resetActiveRouteCache,
  routeFromDoc,
  routeToDoc,
  sortRoutes,
  subscribeActiveRouteId,
  takeLocalRoutes,
  writeActiveRouteId
} from './plannedRoute';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const WIEN = { lat: 48.2082, lng: 16.3738 };

function route(partial: Partial<PlannedRoute>): PlannedRoute {
  return { id: 'r', name: '', date: '', waypoints: [], author: '', updatedAt: 0, ...partial };
}

beforeEach(() => {
  localStorage.clear();
  resetActiveRouteCache();
});

afterEach(() => {
  localStorage.clear();
  resetActiveRouteCache();
});

describe('plannedRoute', () => {
  it('übersetzt zwischen Route und Firestore-Dokument', () => {
    const original = route({
      id: 'tag-1',
      name: 'Tag 1: Passau – Wien',
      date: '2026-05-04',
      waypoints: [createWaypoint(PASSAU.lat, PASSAU.lng), createWaypoint(WIEN.lat, WIEN.lng)],
      author: 'Skipper',
      updatedAt: 1_770_000_000_000
    });

    const back = routeFromDoc('tag-1', routeToDoc(original));

    expect(back).toEqual(original);
    // Die Kennung steckt im Dokumentpfad, nicht in den Feldern.
    expect(routeToDoc(original)).not.toHaveProperty('id');
  });

  it('kommt mit unvollständigen Dokumenten zurecht', () => {
    const parsed = routeFromDoc('kaputt', {
      waypoints: [{ id: 'a', lat: 48, lng: 13 }, { id: 'b', lat: 'nein' }, null],
      updatedAt: 'gestern'
    });

    expect(parsed).toEqual(
      route({ id: 'kaputt', waypoints: [{ id: 'a', lat: 48, lng: 13 }], updatedAt: 0 })
    );
  });

  it('merkt sich die aktive Route auf diesem Gerät und meldet Änderungen', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeActiveRouteId(listener);

    writeActiveRouteId('tag-2');
    expect(readActiveRouteId()).toBe('tag-2');
    expect(listener).toHaveBeenCalledTimes(1);

    // Neu geladene Seite liest denselben Stand aus dem Speicher.
    resetActiveRouteCache();
    expect(readActiveRouteId()).toBe('tag-2');

    writeActiveRouteId(null);
    expect(readActiveRouteId()).toBeNull();

    unsubscribe();
    writeActiveRouteId('tag-3');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('übernimmt gerätelokal gespeicherte Routen genau einmal', () => {
    localStorage.setItem(
      'boat_planned_routes',
      JSON.stringify({
        routes: [
          { id: 'alt-1', name: 'Tag 1', date: '2026-05-04', waypoints: [{ id: 'a', ...PASSAU }] },
          { id: 'alt-2', name: '', date: '', waypoints: [] }
        ],
        activeId: 'alt-1'
      })
    );
    localStorage.setItem('boat_planned_route', JSON.stringify([{ id: 'x', ...WIEN }]));

    const taken = takeLocalRoutes();

    expect(taken.map((r) => r.name)).toEqual(['Tag 1', '']);
    expect(taken[0].waypoints).toHaveLength(1);
    // Die ganz alte Einzelroute kommt als namenlose Route mit.
    expect(taken[1].waypoints[0]).toMatchObject(WIEN);
    expect(localStorage.getItem('boat_planned_routes')).toBeNull();
    expect(localStorage.getItem('boat_planned_route')).toBeNull();
    expect(takeLocalRoutes()).toEqual([]);
  });

  it('findet Routen und rechnet ihre Länge', () => {
    const routes = [route({ id: 'a' }), route({ id: 'b' })];
    expect(findRoute(routes, 'b')?.id).toBe('b');
    expect(findRoute(routes, 'weg')).toBeNull();
    expect(findRoute(routes, null)).toBeNull();

    const km = plannedRouteLengthMeters([PASSAU, WIEN]) / 1000;
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(260);
    expect(plannedRouteLengthMeters([PASSAU])).toBe(0);
  });

  it('sortiert Routen nach Tag, danach nach letzter Änderung', () => {
    const sorted = sortRoutes([
      route({ id: 'c', updatedAt: 10 }),
      route({ id: 'a', date: '2026-05-04' }),
      route({ id: 'd', updatedAt: 20 }),
      route({ id: 'b', date: '2026-05-05' })
    ]);

    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
  });
});
