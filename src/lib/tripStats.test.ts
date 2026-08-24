import { describe, it, expect } from 'vitest';
import {
  totalDistanceKm,
  trackDurationMs,
  formatDuration,
  pointsOfDay,
  pointsOfSession
} from './tripStats';
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

describe('pointsOfSession', () => {
  const older: GpsPoint = { ...point(52, 13, T), sessionId: 'gestern' };
  const current: GpsPoint = { ...point(53, 13, T + 1000), sessionId: 'heute' };
  const nameless = point(54, 13, T + 2000);

  it('behält nur die Punkte der gesuchten Aufzeichnung', () => {
    expect(pointsOfSession([older, current, nameless], 'heute')).toEqual([current]);
  });

  it('gibt ohne Kennung die ganze Spur zurück', () => {
    const all = [older, current, nameless];

    expect(pointsOfSession(all, null)).toEqual(all);
  });

  it('ist leer, wenn zur Aufzeichnung noch kein Punkt gehört', () => {
    expect(pointsOfSession([older, nameless], 'heute')).toEqual([]);
  });
});

describe('pointsOfDay', () => {
  // Alle Zeiten lokal gerechnet, wie die Anzeige selbst: gleicher Kalendertag
  // heißt gleicher Tag auf der Uhr des Geräts.
  const noon = new Date(2026, 7, 24, 12, 0).getTime();
  const morning = point(52, 13, new Date(2026, 7, 24, 6, 30).getTime());
  const evening = point(53, 13, new Date(2026, 7, 24, 21, 45).getTime());
  const yesterday = point(54, 13, new Date(2026, 7, 23, 23, 30).getTime());
  const tomorrow = point(55, 13, new Date(2026, 7, 25, 0, 15).getTime());

  it('behält nur die Punkte desselben Kalendertags', () => {
    expect(pointsOfDay([yesterday, morning, evening, tomorrow], noon)).toEqual([morning, evening]);
  });

  it('nimmt mehrere Fahrten desselben Tages zusammen', () => {
    // Zwei getrennte Aufzeichnungen, ein Tag – genau der Fall, für den es
    // den Tagesausschnitt gibt.
    const first: GpsPoint = { ...morning, sessionId: 'vormittag' };
    const second: GpsPoint = { ...evening, sessionId: 'abend' };

    expect(pointsOfDay([first, second], noon)).toEqual([first, second]);
  });

  it('ist leer, wenn an diesem Tag nichts aufgezeichnet wurde', () => {
    expect(pointsOfDay([yesterday, tomorrow], noon)).toEqual([]);
  });
});
