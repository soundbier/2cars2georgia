/**
 * Von Hand abgesteckte Routen – eine je Tag.
 *
 * Der aufgezeichnete Track entsteht erst während der Fahrt; für den
 * Kartendownload braucht es die Strecke aber vorher. Deshalb lassen sich
 * Routen aus Wegpunkten abstecken, benennen und einem Tag zuordnen: am PC
 * vorbereitet, unterwegs nur noch die Route des Tages aktivieren. Aus der
 * aktiven Route entsteht dann dasselbe Raster wie sonst aus dem Track.
 *
 * Gespeichert wird im Roadtrip (roadtrips/{tripId}/plannedRoutes, siehe
 * hooks/usePlannedRoutes.ts): Wer die Route am großen Bildschirm absteckt,
 * ist selten die Person, die unterwegs die Karten lädt. Firestore hält die
 * Routen dank persistentLocalCache auch offline bereit, sobald sie einmal
 * geladen waren.
 *
 * Gerätelokal bleibt nur die Auswahl der aktiven Route: Welche Route dieses
 * Gerät gerade auf der Karte zeigt und herunterlädt, geht die übrige Crew
 * nichts an – auf zwei Booten sind das schlicht zwei verschiedene.
 *
 * Diese Datei enthält nur Daten und Rechnerei ohne Firestore-Bezug, damit
 * beides einzeln testbar bleibt.
 */

import { distanceMeters } from './geo';
import { SoftDeletable } from './trash';
import { Coordinates } from '../types';

/** Aktive Route dieses Geräts (nur die Kennung, die Route selbst liegt online). */
const ACTIVE_KEY = 'boat_active_route';

/** Speicher der Fassungen vor der Online-Ablage – wird einmalig übernommen. */
const LOCAL_ROUTES_KEY = 'boat_planned_routes';
const LEGACY_SINGLE_KEY = 'boat_planned_route';

export interface PlannedWaypoint extends Coordinates {
  /** Stabile Kennung, damit Marker beim Verschieben nicht neu aufgebaut werden. */
  id: string;
}

export interface PlannedRoute extends SoftDeletable {
  id: string;
  name: string;
  /** Tag der Route als ISO-Datum (YYYY-MM-DD); leer, wenn ohne festen Tag. */
  date: string;
  waypoints: PlannedWaypoint[];
  /** Anzeigename der Person, die zuletzt gespeichert hat. */
  author: string;
  updatedAt: number;
}

/**
 * Obergrenze je Route – dieselbe Zahl steht in firestore.rules.
 *
 * Ein Dokument muss unter 1 MB bleiben; mit ~50 Byte je Wegpunkt ist das
 * weit weg, aber eine versehentliche Klickorgie soll die Route nicht
 * unbrauchbar machen.
 */
export const MAX_WAYPOINTS = 500;

function isWaypoint(value: unknown): value is PlannedWaypoint {
  const point = value as Partial<PlannedWaypoint> | null;
  return (
    !!point &&
    typeof point.id === 'string' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

/**
 * Firestore-Dokument in eine Route übersetzen.
 *
 * Bewusst nachsichtig: Fehlende oder kaputte Felder machen die Route leer,
 * aber nicht die ganze Liste unlesbar.
 */
export function routeFromDoc(id: string, data: Record<string, unknown> | undefined): PlannedRoute {
  const waypoints = Array.isArray(data?.waypoints) ? data.waypoints.filter(isWaypoint) : [];
  return {
    id,
    name: typeof data?.name === 'string' ? data.name : '',
    date: typeof data?.date === 'string' ? data.date : '',
    waypoints: waypoints.slice(0, MAX_WAYPOINTS),
    author: typeof data?.author === 'string' ? data.author : '',
    updatedAt: Number.isFinite(data?.updatedAt) ? (data?.updatedAt as number) : 0,
    // Im Papierkorb liegende Routen kommen mit herein und werden erst in
    // hooks/usePlannedRoutes.ts ausgeblendet – der Papierkorb selbst braucht sie.
    ...(Number.isFinite(data?.deletedAt) ? { deletedAt: data?.deletedAt as number } : {})
  };
}

/** Route als Firestore-Dokument (ohne id, die steckt im Dokumentpfad). */
export function routeToDoc(route: PlannedRoute): Record<string, unknown> {
  return {
    name: route.name,
    date: route.date,
    waypoints: route.waypoints.map((point) => ({ id: point.id, lat: point.lat, lng: point.lng })),
    author: route.author,
    updatedAt: route.updatedAt,
    // Nur schreiben, wenn gesetzt: Firestore lehnt undefined ab, und eine
    // aktive Route soll das Feld gar nicht erst tragen.
    ...(typeof route.deletedAt === 'number' ? { deletedAt: route.deletedAt } : {})
  };
}

let counter = 0;

export function createId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function createWaypoint(lat: number, lng: number): PlannedWaypoint {
  return { id: createId('wp'), lat, lng };
}

// --- Aktive Route dieses Geräts ----------------------------------------

let cachedActiveId: string | null | undefined;
const activeListeners = new Set<() => void>();

export function readActiveRouteId(): string | null {
  if (cachedActiveId === undefined) {
    cachedActiveId = localStorage.getItem(ACTIVE_KEY);
  }
  return cachedActiveId;
}

export function writeActiveRouteId(id: string | null): void {
  cachedActiveId = id;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch (err) {
    console.error('Aktive Route konnte nicht gespeichert werden:', err);
  }
  for (const listener of activeListeners) listener();
}

export function subscribeActiveRouteId(listener: () => void): () => void {
  activeListeners.add(listener);
  return () => {
    activeListeners.delete(listener);
  };
}

/** Nur für Tests: gelesenen Stand vergessen. */
export function resetActiveRouteCache(): void {
  cachedActiveId = undefined;
}

// --- Übernahme der früher gerätelokal gespeicherten Routen --------------

/**
 * Liest die vor der Online-Ablage lokal gespeicherten Routen aus und
 * entfernt sie vom Gerät.
 *
 * Wird einmalig beim ersten Start mit angemeldetem Roadtrip aufgerufen: Wer
 * schon Routen abgesteckt hatte, findet sie danach im Roadtrip wieder,
 * statt vor einer leeren Liste zu stehen. Das Entfernen passiert erst nach
 * dem Auslesen durch den Aufrufer (siehe hooks/usePlannedRoutes.ts) – ein
 * zweiter Aufruf liefert nichts mehr und legt damit auch keine Duplikate an.
 */
export function takeLocalRoutes(): PlannedRoute[] {
  const routes: PlannedRoute[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_ROUTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { routes?: unknown } | null;
      if (Array.isArray(parsed?.routes)) {
        for (const entry of parsed.routes) {
          const route = entry as Partial<PlannedRoute> | null;
          if (!route || typeof route.id !== 'string') continue;
          routes.push(routeFromDoc(route.id, route as Record<string, unknown>));
        }
      }
    }

    // Allererste Fassung: eine einzige Route, gespeichert als reine Liste.
    const legacyRaw = localStorage.getItem(LEGACY_SINGLE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as unknown;
      const waypoints = Array.isArray(parsed) ? parsed.filter(isWaypoint) : [];
      if (waypoints.length > 0) {
        routes.push({
          id: createId('route'),
          name: '',
          date: '',
          waypoints,
          author: '',
          updatedAt: Date.now()
        });
      }
    }

    localStorage.removeItem(LOCAL_ROUTES_KEY);
    localStorage.removeItem(LEGACY_SINGLE_KEY);
  } catch (err) {
    console.error('Lokale Routen konnten nicht übernommen werden:', err);
  }
  return routes.filter((route) => route.waypoints.length > 0 || route.name);
}

// --- Rechnen und Sortieren ---------------------------------------------

export function findRoute(routes: PlannedRoute[], id: string | null): PlannedRoute | null {
  if (!id) return null;
  return routes.find((route) => route.id === id) ?? null;
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
