import { describe, expect, it } from 'vitest';
import {
  newSessionId,
  pointsOfSession,
  sessionStartParts,
  sessionStatsById,
  trackSessionStats
} from './trackSession';
import { GpsPoint } from '../types';

const NOW = 1_770_000_000_000;

function point(overrides: Partial<GpsPoint>): GpsPoint {
  return {
    timestamp: NOW,
    author: 'Skipper',
    lat: 52.52,
    lng: 13.405,
    speedKmh: 10,
    headingDeg: 90,
    ...overrides
  };
}

describe('newSessionId', () => {
  it('vergibt bei jedem Aufruf eine andere Kennung', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newSessionId()));
    expect(ids.size).toBe(50);
  });
});

describe('pointsOfSession', () => {
  const points = [
    point({ timestamp: NOW + 2000, sessionId: 'a' }),
    point({ timestamp: NOW + 1000, sessionId: 'b' }),
    point({ timestamp: NOW, sessionId: 'a' }),
    // Punkte aus der Zeit vor den benannten Aufzeichnungen.
    point({ timestamp: NOW + 500 })
  ];

  it('nimmt nur die Punkte der gesuchten Aufzeichnung, in zeitlicher Reihenfolge', () => {
    expect(pointsOfSession(points, 'a').map((p) => p.timestamp)).toEqual([NOW, NOW + 2000]);
  });

  it('zählt Punkte ohne Aufzeichnung zu keiner davon', () => {
    expect(pointsOfSession(points, 'a')).toHaveLength(2);
    expect(pointsOfSession(points, 'b')).toHaveLength(1);
    expect(pointsOfSession(points, 'unbekannt')).toHaveLength(0);
  });
});

describe('trackSessionStats', () => {
  it('liefert für eine leere Aufzeichnung überall null', () => {
    expect(trackSessionStats([])).toEqual({ pointCount: 0, distanceKm: 0, durationMs: 0 });
  });

  it('rechnet Strecke und Dauer aus den Punkten, nicht aus Start und Stopp', () => {
    const stats = trackSessionStats([
      point({ timestamp: NOW, lat: 52.52, lng: 13.405 }),
      point({ timestamp: NOW + 600_000, lat: 52.53, lng: 13.405 })
    ]);

    expect(stats.pointCount).toBe(2);
    expect(stats.durationMs).toBe(600_000);
    // Ein hundertstel Breitengrad sind gut 1,1 km.
    expect(stats.distanceKm).toBeGreaterThan(1);
    expect(stats.distanceKm).toBeLessThan(1.2);
  });
});

describe('sessionStartParts', () => {
  it('trennt Datum und Uhrzeit für den Namensvorschlag', () => {
    const parts = sessionStartParts(Date.UTC(2026, 4, 4, 9, 30), 'de-DE');
    expect(parts.date).toMatch(/^\d{2}\.\d{2}\.?$/);
    expect(parts.time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('sessionStatsById', () => {
  const points = [
    // Absichtlich durcheinander: Der Ausgangspuffer liefert Punkte nach, die
    // zeitlich vor den bereits geschriebenen liegen.
    point({ timestamp: NOW + 600_000, lat: 52.53, sessionId: 'a' }),
    point({ timestamp: NOW, sessionId: 'a' }),
    point({ timestamp: NOW + 60_000, sessionId: 'b' }),
    // Punkt aus der Zeit vor den benannten Aufzeichnungen.
    point({ timestamp: NOW + 120_000 })
  ];

  it('rechnet jede Aufzeichnung einzeln aus, in zeitlicher Reihenfolge', () => {
    const stats = sessionStatsById(points);

    expect(stats.get('a')?.pointCount).toBe(2);
    expect(stats.get('a')?.durationMs).toBe(600_000);
    expect(stats.get('a')?.distanceKm).toBeGreaterThan(1);
    expect(stats.get('b')?.pointCount).toBe(1);
    expect(stats.get('b')?.durationMs).toBe(0);
  });

  it('ordnet Punkte ohne Kennung keiner Aufzeichnung zu', () => {
    expect([...sessionStatsById(points).keys()].sort()).toEqual(['a', 'b']);
  });
});
