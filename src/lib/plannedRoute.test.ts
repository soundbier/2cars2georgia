import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createWaypoint,
  plannedRouteLengthMeters,
  readPlannedRoute,
  resetPlannedRouteCache,
  subscribePlannedRoute,
  writePlannedRoute
} from './plannedRoute';

beforeEach(() => {
  localStorage.clear();
  resetPlannedRouteCache();
});

afterEach(() => {
  localStorage.clear();
  resetPlannedRouteCache();
});

describe('plannedRoute', () => {
  it('startet ohne Wegpunkte', () => {
    expect(readPlannedRoute()).toEqual([]);
  });

  it('speichert Wegpunkte über einen Neustart hinweg', () => {
    writePlannedRoute([createWaypoint(48.5667, 13.4319), createWaypoint(48.2082, 16.3738)]);

    resetPlannedRouteCache();
    const stored = readPlannedRoute();

    expect(stored).toHaveLength(2);
    expect(stored[0].lat).toBeCloseTo(48.5667);
    expect(stored[1].lng).toBeCloseTo(16.3738);
    expect(stored[0].id).not.toBe(stored[1].id);
  });

  it('meldet Änderungen an die Karte', () => {
    let calls = 0;
    const unsubscribe = subscribePlannedRoute(() => {
      calls += 1;
    });

    writePlannedRoute([createWaypoint(48, 13)]);
    expect(calls).toBe(1);

    unsubscribe();
    writePlannedRoute([]);
    expect(calls).toBe(1);
  });

  it('überspringt unbrauchbare Einträge im Speicher', () => {
    localStorage.setItem(
      'boat_planned_route',
      JSON.stringify([{ id: 'a', lat: 48, lng: 13 }, { id: 'b', lat: 'nein' }, null])
    );

    expect(readPlannedRoute()).toEqual([{ id: 'a', lat: 48, lng: 13 }]);
  });

  it('rechnet die Länge der geplanten Route', () => {
    // Passau → Wien, gut 250 km Luftlinie.
    const meters = plannedRouteLengthMeters([
      { lat: 48.5667, lng: 13.4319 },
      { lat: 48.2082, lng: 16.3738 }
    ]);

    expect(meters / 1000).toBeGreaterThan(200);
    expect(meters / 1000).toBeLessThan(260);
    expect(plannedRouteLengthMeters([{ lat: 48, lng: 13 }])).toBe(0);
  });
});
