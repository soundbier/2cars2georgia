import { describe, it, expect } from 'vitest';
import { totalDistanceKm, trackDurationMs, formatDuration } from './tripStats';
import { GpsPoint } from '../types';

const T = 1_700_000_000_000;

function point(lat: number, lng: number, timestamp = T): GpsPoint {
  return { lat, lng, timestamp, author: 'Lukas', speedKmh: 0, headingDeg: null };
}

describe('totalDistanceKm', () => {
  it('summiert die Abschnitte zwischen den Punkten', () => {
    // Ein Breitengrad entspricht rund 111 km.
    const km = totalDistanceKm([point(52, 13), point(53, 13), point(54, 13)]);

    expect(km).toBeGreaterThan(220);
    expect(km).toBeLessThan(224);
  });

  it('ist ohne oder mit nur einem Punkt null', () => {
    expect(totalDistanceKm([])).toBe(0);
    expect(totalDistanceKm([point(52, 13)])).toBe(0);
  });
});

describe('trackDurationMs', () => {
  it('misst vom ersten bis zum letzten Punkt', () => {
    expect(trackDurationMs([point(52, 13, T), point(52, 13, T + 90 * 60_000)])).toBe(90 * 60_000);
  });

  it('ist bei höchstens einem Punkt null', () => {
    expect(trackDurationMs([point(52, 13)])).toBe(0);
    expect(trackDurationMs([])).toBe(0);
  });
});

describe('formatDuration', () => {
  it('zeigt Stunden und Minuten', () => {
    expect(formatDuration(0)).toBe('0h 0m');
    expect(formatDuration(90 * 60_000)).toBe('1h 30m');
    expect(formatDuration(25 * 3_600_000)).toBe('25h 0m');
  });
});
