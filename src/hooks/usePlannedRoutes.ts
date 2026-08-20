import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './useCollection';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { usePermissions } from './usePermissions';
import { trackWrite } from '../lib/pendingWrites';
import {
  createId,
  createWaypoint,
  findRoute,
  MAX_WAYPOINTS,
  PlannedRoute,
  PlannedWaypoint,
  readActiveRouteId,
  routeFromDoc,
  routeToDoc,
  sortRoutes,
  subscribeActiveRouteId,
  takeLocalRoutes,
  writeActiveRouteId
} from '../lib/plannedRoute';

/**
 * Geplante Routen des aktuellen Roadtrips.
 *
 * Die Routen liegen unter roadtrips/{tripId}/plannedRoutes und gelten damit
 * für die ganze Crew: am PC abgesteckt, unterwegs auf dem Telefon geladen.
 * Welche Route dieses Gerät gerade verwendet, bleibt dagegen lokal (siehe
 * lib/plannedRoute.ts) – jedes Gerät lädt die Karten, die es braucht.
 */

const COLLECTION = 'plannedRoutes';

/** Wie ein Firestore-Dokument aus der Collection hereinkommt. */
type RouteDoc = Record<string, unknown> & { id: string };

export interface PlannedRoutesState {
  /** Alle Routen des Roadtrips, in Fahrreihenfolge. */
  routes: PlannedRoute[];
  /** Route, die auf diesem Gerät für Karte und Download gilt. */
  activeRoute: PlannedRoute | null;
  activeId: string | null;
  /** true, solange kein Roadtrip ausgewählt ist – dann geht nichts zu speichern. */
  offline: boolean;
  canEdit: boolean;
  setActive: (id: string | null) => void;
  create: (name: string, date: string) => PlannedRoute | null;
  rename: (route: PlannedRoute, name: string, date: string) => void;
  setWaypoints: (route: PlannedRoute, waypoints: PlannedWaypoint[]) => void;
  duplicate: (route: PlannedRoute, name: string) => PlannedRoute | null;
  remove: (route: PlannedRoute) => void;
}

function useStoredRoutes(): PlannedRoute[] {
  const { tripId } = useRoadtrip();
  const docs = useCollection<RouteDoc>(tripId ? tripPath(tripId, COLLECTION) : null, 'updatedAt', 'desc');
  return useMemo(() => sortRoutes(docs.map((entry) => routeFromDoc(entry.id, entry))), [docs]);
}

/** Aktive Route dieses Geräts, unabhängig von der Planerseite abrufbar. */
export function useActiveRouteId(): string | null {
  return useSyncExternalStore(subscribeActiveRouteId, readActiveRouteId, () => null);
}

export function usePlannedRoutes(): PlannedRoutesState {
  const { tripId, displayName } = useRoadtrip();
  const { canEdit } = usePermissions();
  const routes = useStoredRoutes();
  const storedActiveId = useActiveRouteId();

  // Eine gelöschte Route darf nicht weiter als aktiv gelten – sonst zeigte
  // die Karte eine Strecke an, die es nicht mehr gibt.
  const activeRoute = findRoute(routes, storedActiveId);
  const activeId = activeRoute?.id ?? null;

  const write = useCallback(
    (route: PlannedRoute) => {
      if (!tripId) return;
      const ref = doc(db, tripPath(tripId, COLLECTION, route.id));
      trackWrite(setDoc(ref, routeToDoc(route))).catch((err) =>
        console.error('Route konnte nicht gespeichert werden:', err)
      );
    },
    [tripId]
  );

  const build = useCallback(
    (name: string, date: string, waypoints: PlannedWaypoint[]): PlannedRoute => ({
      id: createId('route'),
      name: name.trim(),
      date,
      waypoints,
      author: displayName ?? '',
      updatedAt: Date.now()
    }),
    [displayName]
  );

  useLocalRouteImport(tripId, canEdit, write);

  const create = useCallback(
    (name: string, date: string) => {
      if (!tripId || !canEdit) return null;
      const route = build(name, date, []);
      write(route);
      writeActiveRouteId(route.id);
      return route;
    },
    [build, canEdit, tripId, write]
  );

  const update = useCallback(
    (route: PlannedRoute, change: Partial<PlannedRoute>) => {
      if (!canEdit) return;
      write({ ...route, ...change, author: displayName ?? route.author, updatedAt: Date.now() });
    },
    [canEdit, displayName, write]
  );

  return {
    routes,
    activeRoute,
    activeId,
    offline: !tripId,
    canEdit,
    setActive: writeActiveRouteId,
    create,
    rename: useCallback(
      (route, name, date) => update(route, { name: name.trim(), date }),
      [update]
    ),
    setWaypoints: useCallback(
      (route, waypoints) => update(route, { waypoints: waypoints.slice(0, MAX_WAYPOINTS) }),
      [update]
    ),
    duplicate: useCallback(
      (route, name) => {
        if (!tripId || !canEdit) return null;
        const copy = build(
          name,
          '',
          // Neue Kennungen: sonst zeigten Marker beider Routen auf denselben Punkt.
          route.waypoints.map((point) => createWaypoint(point.lat, point.lng))
        );
        write(copy);
        writeActiveRouteId(copy.id);
        return copy;
      },
      [build, canEdit, tripId, write]
    ),
    remove: useCallback(
      (route) => {
        if (!tripId || !canEdit) return;
        if (readActiveRouteId() === route.id) writeActiveRouteId(null);
        trackWrite(deleteDoc(doc(db, tripPath(tripId, COLLECTION, route.id)))).catch((err) =>
          console.error('Route konnte nicht gelöscht werden:', err)
        );
      },
      [canEdit, tripId]
    )
  };
}

/**
 * Übernimmt einmalig die früher gerätelokal gespeicherten Routen in den
 * Roadtrip, damit nach dem Update nichts verschwunden wirkt.
 */
function useLocalRouteImport(
  tripId: string | null,
  canEdit: boolean,
  write: (route: PlannedRoute) => void
): void {
  const writeRef = useRef(write);
  writeRef.current = write;

  useEffect(() => {
    if (!tripId || !canEdit) return;
    const local = takeLocalRoutes();
    if (local.length === 0) return;
    for (const route of local) writeRef.current(route);
  }, [tripId, canEdit]);
}

/** Aktive Route – die, deren Strecke auf der Karte und im Download gilt. */
export function useActivePlannedRoute(): PlannedRoute | null {
  const routes = useStoredRoutes();
  const activeId = useActiveRouteId();
  return findRoute(routes, activeId);
}
