import { GpsPoint } from '../types';
import { distanceMeters } from './geo';

/** Gesamtstrecke entlang der Trackpunkte in Kilometern. */
export function totalDistanceKm(points: GpsPoint[]): number {
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += distanceMeters(points[i - 1], points[i]);
  }
  return totalMeters / 1000;
}

/**
 * Die Punkte genau einer Aufzeichnung.
 *
 * Jeder Punkt trägt die Kennung der Aufzeichnung, unter der er entstanden ist
 * (siehe hooks/useTracking.tsx) – damit lässt sich die aktuelle Route aus der
 * Gesamtspur des Roadtrips herauslösen. Ohne Kennung gibt es nichts zu
 * trennen: Dann ist die Gesamtspur die Antwort.
 */
export function pointsOfSession(points: GpsPoint[], sessionId: string | null): GpsPoint[] {
  if (!sessionId) return points;
  return points.filter((point) => point.sessionId === sessionId);
}

/** Zeitspanne zwischen erstem und letztem Trackpunkt in Millisekunden. */
export function trackDurationMs(points: GpsPoint[]): number {
  return points.length > 1 ? points[points.length - 1].timestamp - points[0].timestamp : 0;
}

export function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
