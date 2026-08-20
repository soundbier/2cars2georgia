/**
 * Von Hand abgesteckte Route.
 *
 * Der aufgezeichnete Track entsteht erst während der Fahrt – für den
 * Kartendownload braucht es die Strecke aber vorher. Deshalb lässt sich eine
 * Route aus Wegpunkten auf der Karte abstecken; aus ihr entsteht dann
 * dasselbe Raster wie sonst aus dem Track.
 *
 * Bewusst in localStorage statt in Firestore: Die geplante Route hängt am
 * Gerät, das offline gehen soll, muss ohne Netz sofort lesbar sein und darf
 * für die Offline-Funktion keinen Server voraussetzen (siehe
 * lib/offlineTiles.ts).
 */

import { distanceMeters } from './geo';
import { Coordinates } from '../types';

const STORAGE_KEY = 'boat_planned_route';

export interface PlannedWaypoint extends Coordinates {
  /** Stabile Kennung, damit Marker beim Verschieben nicht neu aufgebaut werden. */
  id: string;
}

let cached: PlannedWaypoint[] | null = null;
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

/** Alle gesetzten Wegpunkte in der Reihenfolge, in der sie gesetzt wurden. */
export function readPlannedRoute(): PlannedWaypoint[] {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cached = Array.isArray(parsed) ? parsed.filter(isWaypoint) : [];
  } catch (err) {
    console.error('Geplante Route konnte nicht gelesen werden:', err);
    cached = [];
  }
  return cached;
}

export function writePlannedRoute(points: PlannedWaypoint[]): void {
  cached = points;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  } catch (err) {
    console.error('Geplante Route konnte nicht gespeichert werden:', err);
  }
  for (const listener of listeners) listener();
}

/** Benachrichtigt bei jeder Änderung an der geplanten Route. */
export function subscribePlannedRoute(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nur für Tests: gelesene Route vergessen. */
export function resetPlannedRouteCache(): void {
  cached = null;
}

let counter = 0;

export function createWaypoint(lat: number, lng: number): PlannedWaypoint {
  counter += 1;
  return { id: `wp-${Date.now().toString(36)}-${counter}`, lat, lng };
}

/** Länge der geplanten Route in Metern (Luftlinie zwischen den Wegpunkten). */
export function plannedRouteLengthMeters(points: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}
