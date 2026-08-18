import { GpsPoint, LogEvent } from '../types';
import { totalDistanceKm, trackDurationMs } from './tripStats';

/**
 * Tagesübersichten für das Teilbild (siehe lib/routeImage.ts).
 *
 * Ein Roadtrip hat in Firestore keinen eigenen Tages-Begriff – Track und
 * Ereignisse sind eine durchgehende Liste. Für die Instagram-Tagesübersicht
 * gruppieren wir stattdessen nachträglich nach Kalendertag in der lokalen
 * Zeitzone des Geräts: Wer nachts um 1 Uhr noch fährt, erwartet das als „heute
 * Nacht“ zu sehen, nicht als eigenen Tag ab Mitternacht UTC.
 */

/** Schlüssel eines Kalendertags, z. B. "2026-08-18" – stabil sortierbar. */
export type DayKey = string;

export interface DayRecap {
  key: DayKey;
  /** Datum des Tages, auf Mitternacht lokal gesetzt. */
  date: Date;
  track: GpsPoint[];
  events: LogEvent[];
  distanceKm: number;
  durationMs: number;
  authors: string[];
}

function dayKey(timestamp: number): DayKey {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Gruppiert Track und Ereignisse nach Kalendertag, neuester Tag zuerst.
 *
 * Ein Tag ohne Trackpunkte, aber mit Ereignissen, taucht trotzdem auf – die
 * Strecke ist dann schlicht 0.
 */
export function groupByDay(track: GpsPoint[], events: LogEvent[]): DayRecap[] {
  const byKey = new Map<DayKey, { track: GpsPoint[]; events: LogEvent[] }>();

  const bucket = (key: DayKey) => {
    let entry = byKey.get(key);
    if (!entry) {
      entry = { track: [], events: [] };
      byKey.set(key, entry);
    }
    return entry;
  };

  for (const point of track) bucket(dayKey(point.timestamp)).track.push(point);
  for (const event of events) bucket(dayKey(event.timestamp)).events.push(event);

  return Array.from(byKey.entries())
    .map(([key, { track: dayTrack, events: dayEvents }]) => {
      const [y, m, d] = key.split('-').map(Number);
      const authors = Array.from(
        new Set([...dayTrack.map((p) => p.author), ...dayEvents.map((e) => e.author)])
      ).sort();
      return {
        key,
        date: new Date(y, m - 1, d),
        track: dayTrack,
        events: dayEvents,
        distanceKm: totalDistanceKm(dayTrack),
        durationMs: trackDurationMs(dayTrack),
        authors
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** Der jüngste Tag mit mindestens zwei Trackpunkten, sonst der jüngste Tag überhaupt. */
export function mostRecentDay(days: DayRecap[]): DayRecap | null {
  return days.find((d) => d.track.length > 1) ?? days[0] ?? null;
}
