/**
 * Von Hand abgesteckte Routen – eine je Tag.
 *
 * Der aufgezeichnete Track entsteht erst während der Fahrt; für den
 * Kartendownload braucht es die Strecke aber vorher. Deshalb lassen sich
 * Routen aus Wegpunkten abstecken, benennen und einem Tag zuordnen: am PC
 * vorbereitet, unterwegs nur noch die Route des Tages aktivieren. Aus der
 * aktiven Route entsteht dann dasselbe Raster wie sonst aus dem Track.
 *
 * Bewusst in localStorage statt in Firestore: Die geplanten Routen hängen am
 * Gerät, das offline gehen soll, müssen ohne Netz sofort lesbar sein und
 * dürfen für die Offline-Funktion keinen Server voraussetzen (siehe
 * lib/offlineTiles.ts).
 */

import { distanceMeters } from './geo';
import { Coordinates } from '../types';

const STORAGE_KEY = 'boat_planned_routes';

/** Speicher der ersten Fassung: eine einzige Route ohne Namen. */
const LEGACY_STORAGE_KEY = 'boat_planned_route';

export interface PlannedWaypoint extends Coordinates {
  /** Stabile Kennung, damit Marker beim Verschieben nicht neu aufgebaut werden. */
  id: string;
}

export interface PlannedRoute {
  id: string;
  name: string;
  /** Tag der Route als ISO-Datum (YYYY-MM-DD); leer, wenn ohne festen Tag. */
  date: string;
  waypoints: PlannedWaypoint[];
  updatedAt: number;
}

export interface PlannedRouteStore {
  routes: PlannedRoute[];
  /** Route, die auf der Karte gezeigt und für den Download verwendet wird. */
  activeId: string | null;
}

const EMPTY_STORE: PlannedRouteStore = { routes: [], activeId: null };

let cached: PlannedRouteStore | null = null;
const listeners = new Set<() => void>();

function isWaypoint(value: unknown): value is PlannedWaypoint {
  const point = value as Partial<PlannedWaypoint> | null;
  return (
    !!point &&
    typeof point.id === 'string' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

function toRoute(value: unknown): PlannedRoute | null {
  const route = value as Partial<PlannedRoute> | null;
  if (!route || typeof route.id !== 'string') return null;
  return {
    id: route.id,
    name: typeof route.name === 'string' ? route.name : '',
    date: typeof route.date === 'string' ? route.date : '',
    waypoints: Array.isArray(route.waypoints) ? route.waypoints.filter(isWaypoint) : [],
    updatedAt: Number.isFinite(route.updatedAt) ? (route.updatedAt as number) : 0
  };
}

/**
 * Route der ersten Fassung übernehmen.
 *
 * Wer schon eine Strecke abgesteckt hatte, soll sie nach dem Update
 * wiederfinden – als benannte Route ohne Tag.
 */
function migrateLegacyRoute(): PlannedRouteStore {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return EMPTY_STORE;

  const parsed = JSON.parse(raw) as unknown;
  const waypoints = Array.isArray(parsed) ? parsed.filter(isWaypoint) : [];
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (waypoints.length === 0) return EMPTY_STORE;

  const route: PlannedRoute = {
    id: createId('route'),
    name: '',
    date: '',
    waypoints,
    updatedAt: Date.now()
  };
  const store: PlannedRouteStore = { routes: [route], activeId: route.id };
  persist(store);
  return store;
}

/** Alle gespeicherten Routen samt der aktiven Auswahl. */
export function readPlannedRoutes(): PlannedRouteStore {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = migrateLegacyRoute();
      return cached;
    }
    const parsed = JSON.parse(raw) as Partial<PlannedRouteStore> | null;
    const routes = Array.isArray(parsed?.routes)
      ? parsed.routes.map(toRoute).filter((route): route is PlannedRoute => route !== null)
      : [];
    const activeId = typeof parsed?.activeId === 'string' ? parsed.activeId : null;
    cached = {
      routes,
      activeId: routes.some((route) => route.id === activeId) ? activeId : null
    };
  } catch (err) {
    console.error('Geplante Routen konnten nicht gelesen werden:', err);
    cached = EMPTY_STORE;
  }
  return cached;
}

function persist(store: PlannedRouteStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('Geplante Routen konnten nicht gespeichert werden:', err);
  }
}

export function writePlannedRoutes(store: PlannedRouteStore): void {
  cached = store;
  persist(store);
  for (const listener of listeners) listener();
}

/** Benachrichtigt bei jeder Änderung an den geplanten Routen. */
export function subscribePlannedRoutes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nur für Tests: gelesenen Stand vergessen. */
export function resetPlannedRoutesCache(): void {
  cached = null;
}

let counter = 0;

function createId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function createWaypoint(lat: number, lng: number): PlannedWaypoint {
  return { id: createId('wp'), lat, lng };
}

/** Legt eine leere Route an und macht sie zur aktiven. */
export function createRoute(name: string, date: string): PlannedRoute {
  const route: PlannedRoute = {
    id: createId('route'),
    name: name.trim(),
    date,
    waypoints: [],
    updatedAt: Date.now()
  };
  const store = readPlannedRoutes();
  writePlannedRoutes({ routes: [...store.routes, route], activeId: route.id });
  return route;
}

function updateRoute(id: string, change: (route: PlannedRoute) => PlannedRoute): void {
  const store = readPlannedRoutes();
  writePlannedRoutes({
    ...store,
    routes: store.routes.map((route) =>
      route.id === id ? { ...change(route), updatedAt: Date.now() } : route
    )
  });
}

export function renameRoute(id: string, name: string, date: string): void {
  updateRoute(id, (route) => ({ ...route, name: name.trim(), date }));
}

export function setRouteWaypoints(id: string, waypoints: PlannedWaypoint[]): void {
  updateRoute(id, (route) => ({ ...route, waypoints }));
}

export function deleteRoute(id: string): void {
  const store = readPlannedRoutes();
  writePlannedRoutes({
    routes: store.routes.filter((route) => route.id !== id),
    activeId: store.activeId === id ? null : store.activeId
  });
}

/** Kopiert eine Route samt Wegpunkten – Grundlage für den nächsten Tag. */
export function duplicateRoute(id: string, name: string): PlannedRoute | null {
  const store = readPlannedRoutes();
  const source = store.routes.find((route) => route.id === id);
  if (!source) return null;

  const copy: PlannedRoute = {
    id: createId('route'),
    name: name.trim(),
    date: '',
    // Neue Kennungen: sonst zeigten Marker beider Routen auf denselben Punkt.
    waypoints: source.waypoints.map((point) => createWaypoint(point.lat, point.lng)),
    updatedAt: Date.now()
  };
  writePlannedRoutes({ routes: [...store.routes, copy], activeId: copy.id });
  return copy;
}

/** Wählt die Route, die auf der Karte gilt. `null` = wieder der Track. */
export function setActiveRoute(id: string | null): void {
  const store = readPlannedRoutes();
  writePlannedRoutes({ ...store, activeId: id && store.routes.some((r) => r.id === id) ? id : null });
}

export function findRoute(store: PlannedRouteStore, id: string | null): PlannedRoute | null {
  if (!id) return null;
  return store.routes.find((route) => route.id === id) ?? null;
}

/** Länge einer Route in Metern (Luftlinie zwischen den Wegpunkten). */
export function plannedRouteLengthMeters(points: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/**
 * Routen in der Reihenfolge, in der man sie fährt: erst die mit Tag nach
 * Datum, danach die ohne Tag nach letzter Änderung.
 */
export function sortRoutes(routes: PlannedRoute[]): PlannedRoute[] {
  return [...routes].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return b.updatedAt - a.updatedAt;
  });
}
