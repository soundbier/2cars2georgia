import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fakeFirestoreModule, readFakeCollection, resetFakeFirestore, seedFakeDoc } from '../test/fakeFirestore';
import { CrewRole } from '../types';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());

// Roadtrip und Rolle stehen im Test fest – wie sie zustande kommen, prüft
// useRoadtrip selbst bzw. tests/rules/firestore.rules.test.ts.
const roadtrip = { tripId: 'sommertour' as string | null, displayName: 'Skipper', role: 'owner' as CrewRole };
vi.mock('./useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const { usePlannedRoutes, useActivePlannedRoute } = await import('./usePlannedRoutes');
const { readActiveRouteId, resetActiveRouteCache, writeActiveRouteId } = await import('../lib/plannedRoute');

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };
const ROUTES_PATH = 'roadtrips/sommertour/plannedRoutes';

beforeEach(() => {
  resetFakeFirestore();
  localStorage.clear();
  resetActiveRouteCache();
  roadtrip.tripId = 'sommertour';
  roadtrip.role = 'owner';
});

describe('usePlannedRoutes', () => {
  it('legt eine Route im Roadtrip an und aktiviert sie auf diesem Gerät', () => {
    const { result } = renderHook(() => usePlannedRoutes());

    let id = '';
    act(() => {
      id = result.current.create('Tag 1: Passau – Linz', '2026-05-04')?.id ?? '';
    });

    const stored = readFakeCollection(ROUTES_PATH);
    expect(stored).toHaveLength(1);
    expect(stored[0].data).toMatchObject({
      name: 'Tag 1: Passau – Linz',
      date: '2026-05-04',
      author: 'Skipper',
      waypoints: []
    });
    expect(result.current.routes.map((r) => r.id)).toEqual([id]);
    // Die Auswahl gehört dem Gerät, nicht dem Roadtrip.
    expect(readActiveRouteId()).toBe(id);
    expect(result.current.activeRoute?.id).toBe(id);
  });

  it('speichert Wegpunkte, benennt um und löscht für die ganze Crew', async () => {
    const { result } = renderHook(() => usePlannedRoutes());
    act(() => {
      result.current.create('Tag 1', '');
    });

    act(() => {
      result.current.setWaypoints(result.current.routes[0], [
        { id: 'a', ...PASSAU },
        { id: 'b', ...LINZ }
      ]);
    });
    expect(result.current.routes[0].waypoints).toHaveLength(2);

    act(() => result.current.rename(result.current.routes[0], 'Tag 1: Donau', '2026-05-04'));
    expect(result.current.routes[0]).toMatchObject({ name: 'Tag 1: Donau', date: '2026-05-04' });

    const deleted = result.current.routes[0];
    await act(async () => {
      await result.current.remove(deleted);
    });
    // Gelöscht heißt Papierkorb: aus der Liste raus, aber noch da – und
    // damit über den Rückgängig-Toast wieder zurückzuholen.
    expect(result.current.routes).toHaveLength(0);
    expect(readFakeCollection(ROUTES_PATH)[0].data).toMatchObject({ deletedAt: expect.any(Number) });
    // Eine gelöschte Route bleibt nicht als aktive Auswahl zurück.
    expect(readActiveRouteId()).toBeNull();
    expect(result.current.activeRoute).toBeNull();

    await act(async () => {
      await result.current.restore(deleted.id);
    });
    expect(result.current.routes.map((r) => r.name)).toEqual(['Tag 1: Donau']);
    expect(readFakeCollection(ROUTES_PATH)[0].data).not.toHaveProperty('deletedAt');
  });

  it('kopiert eine Route mit eigenen Wegpunkt-Kennungen', () => {
    seedFakeDoc(`${ROUTES_PATH}/tag-1`, {
      name: 'Tag 1',
      date: '2026-05-04',
      waypoints: [{ id: 'a', ...PASSAU }],
      author: 'Skipper',
      updatedAt: 1_770_000_000_000
    });
    const { result } = renderHook(() => usePlannedRoutes());

    act(() => {
      result.current.duplicate(result.current.routes[0], 'Tag 1 (Kopie)');
    });

    const copy = result.current.routes.find((r) => r.name === 'Tag 1 (Kopie)');
    expect(copy?.waypoints[0]).toMatchObject(PASSAU);
    expect(copy?.waypoints[0].id).not.toBe('a');
    // Eine Kopie ist die Vorlage für einen anderen Tag, erbt ihn also nicht.
    expect(copy?.date).toBe('');
  });

  it('zeigt allen Geräten dieselben Routen, aber je eigene Auswahl', () => {
    seedFakeDoc(`${ROUTES_PATH}/tag-1`, { waypoints: [{ id: 'a', ...PASSAU }], updatedAt: 1 });
    seedFakeDoc(`${ROUTES_PATH}/tag-2`, { waypoints: [{ id: 'b', ...LINZ }], updatedAt: 2 });

    const { result } = renderHook(() => useActivePlannedRoute());
    expect(result.current).toBeNull();

    act(() => writeActiveRouteId('tag-2'));
    expect(result.current?.id).toBe('tag-2');
    expect(result.current?.waypoints[0]).toMatchObject(LINZ);
  });

  it('übernimmt beim ersten Start die früher lokal gespeicherten Routen', () => {
    localStorage.setItem(
      'boat_planned_routes',
      JSON.stringify({
        routes: [{ id: 'alt', name: 'Tag 1', date: '', waypoints: [{ id: 'a', ...PASSAU }] }],
        activeId: 'alt'
      })
    );

    const { result } = renderHook(() => usePlannedRoutes());

    expect(result.current.routes.map((r) => r.name)).toEqual(['Tag 1']);
    expect(readFakeCollection(ROUTES_PATH)).toHaveLength(1);
    expect(localStorage.getItem('boat_planned_routes')).toBeNull();
  });

  it('schreibt ohne Schreibrecht nichts', async () => {
    roadtrip.role = 'readonly';
    seedFakeDoc(`${ROUTES_PATH}/tag-1`, { waypoints: [], updatedAt: 1 });
    const { result } = renderHook(() => usePlannedRoutes());

    expect(result.current.canEdit).toBe(false);
    act(() => {
      expect(result.current.create('Tag 2', '')).toBeNull();
    });
    await act(async () => {
      expect(await result.current.remove(result.current.routes[0])).toBe(false);
    });

    // Lesen ja, ändern nein – durchgesetzt wird das in firestore.rules.
    expect(readFakeCollection(ROUTES_PATH)).toHaveLength(1);
    expect(readFakeCollection(ROUTES_PATH)[0].data).not.toHaveProperty('deletedAt');
  });

  it('speichert ohne ausgewählten Roadtrip nichts', () => {
    roadtrip.tripId = null;
    const { result } = renderHook(() => usePlannedRoutes());

    act(() => {
      expect(result.current.create('Tag 1', '')).toBeNull();
    });

    expect(result.current.offline).toBe(true);
    expect(result.current.routes).toEqual([]);
  });
});
