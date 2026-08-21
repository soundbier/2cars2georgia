import { GpsPoint } from '../types';
import { totalDistanceKm, trackDurationMs } from './tripStats';

/**
 * Kennung einer Aufzeichnung.
 *
 * Wird beim Start der Tour vergeben und an jeden Trackpunkt geschrieben, lange
 * bevor feststeht, ob die Aufzeichnung am Ende überhaupt benannt wird. Deshalb
 * entsteht sie im Client und nicht als Firestore-Dokument-ID: Für eine Tour,
 * die niemand speichert, soll kein Dokument angelegt werden müssen.
 */
export function newSessionId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Ältere WebViews ohne randomUUID: Zeit plus Zufall reicht, da die Kennung
  // nur innerhalb eines Roadtrips eindeutig sein muss.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Die Punkte einer einzelnen Aufzeichnung, in der Reihenfolge der Aufnahme. */
export function pointsOfSession(points: GpsPoint[], sessionId: string): GpsPoint[] {
  return points.filter((point) => point.sessionId === sessionId).sort((a, b) => a.timestamp - b.timestamp);
}

export interface TrackSessionStats {
  pointCount: number;
  distanceKm: number;
  durationMs: number;
}

/**
 * Kennzahlen einer Aufzeichnung für die Speichern-Ansicht.
 *
 * Die Dauer kommt aus den Punkten und nicht aus start/end der Tour: Eine Pause
 * am Ende der Fahrt, bei der die Aufzeichnung noch lief, soll die gefahrene
 * Zeit nicht aufblähen.
 */
export function trackSessionStats(points: GpsPoint[]): TrackSessionStats {
  return {
    pointCount: points.length,
    distanceKm: totalDistanceKm(points),
    durationMs: trackDurationMs(points)
  };
}

/**
 * Datum und Uhrzeit des Starts, getrennt formatiert für den Namensvorschlag.
 *
 * Ein Vorschlag statt eines leeren Feldes, weil die häufigste Antwort auf
 * „wie soll die Fahrt heißen" ist, sie gar nicht benennen zu wollen – so
 * bleibt sie trotzdem unterscheidbar. Zusammengesetzt wird der Text in der
 * Übersetzung (`trackSession.defaultName`), damit die Reihenfolge zur Sprache
 * passt.
 */
export function sessionStartParts(startedAt: number, locale: string): { date: string; time: string } {
  const start = new Date(startedAt);
  return {
    date: start.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
    time: start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  };
}

/** Höchstlänge des Namens – identisch zur Prüfung in firestore.rules. */
export const SESSION_NAME_MAX_LENGTH = 120;
