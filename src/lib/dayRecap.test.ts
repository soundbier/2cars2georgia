import { describe, it, expect } from 'vitest';
import { groupByDay, mostRecentDay } from './dayRecap';
import { GpsPoint, LogEvent } from '../types';

function point(timestamp: number, author = 'Lukas'): GpsPoint {
  return { lat: 52, lng: 13, timestamp, author, speedKmh: 0, headingDeg: null };
}

function event(timestamp: number, author = 'Leon'): LogEvent {
  return { timestamp, author, type: 'pause', title: 'Pause', lat: 52, lng: 13 };
}

// 18.08.2026, 10:00 lokal.
const DAY1 = new Date(2026, 7, 18, 10, 0).getTime();
// Gleicher Kalendertag, 22:00 lokal.
const DAY1_LATE = new Date(2026, 7, 18, 22, 0).getTime();
// Folgetag, 08:00 lokal.
const DAY2 = new Date(2026, 7, 19, 8, 0).getTime();

describe('groupByDay', () => {
  it('gruppiert Track und Ereignisse nach lokalem Kalendertag', () => {
    const days = groupByDay(
      [point(DAY1), point(DAY1_LATE), point(DAY2)],
      [event(DAY1), event(DAY2)]
    );

    expect(days).toHaveLength(2);
    expect(days[0].key).toBe('2026-08-19');
    expect(days[0].track).toHaveLength(1);
    expect(days[0].events).toHaveLength(1);
    expect(days[1].key).toBe('2026-08-18');
    expect(days[1].track).toHaveLength(2);
    expect(days[1].events).toHaveLength(1);
  });

  it('sortiert neuste zuerst und listet beteiligte Crewmitglieder', () => {
    const days = groupByDay([point(DAY1, 'Lukas'), point(DAY1, 'Leon')], []);

    expect(days[0].authors).toEqual(['Leon', 'Lukas']);
  });

  it('ist ohne Daten leer', () => {
    expect(groupByDay([], [])).toEqual([]);
  });
});

describe('mostRecentDay', () => {
  it('bevorzugt den jüngsten Tag mit mindestens zwei Trackpunkten', () => {
    const days = groupByDay(
      [point(DAY1), point(DAY1_LATE), point(DAY2)],
      []
    );

    expect(mostRecentDay(days)?.key).toBe('2026-08-18');
  });

  it('fällt ohne ausreichenden Track auf den jüngsten Tag zurück', () => {
    const days = groupByDay([point(DAY2)], [event(DAY1)]);

    expect(mostRecentDay(days)?.key).toBe('2026-08-19');
  });

  it('ist ohne Tage null', () => {
    expect(mostRecentDay([])).toBeNull();
  });
});
