import { describe, it, expect } from 'vitest';
import {
  analyzeTrack,
  distanceByAuthor,
  eventCountsByType,
  speedHistogram,
  speedSeries,
  EMPTY_ANALYSIS
} from './statistics';
import { GpsPoint, LogEvent } from '../types';

const T = 1_700_000_000_000;

function point(
  lat: number,
  lng: number,
  timestamp: number,
  speedKmh = 0,
  author = 'Lukas'
): GpsPoint {
  return { lat, lng, timestamp, author, speedKmh, headingDeg: null };
}

/** Rund 1,11 km je Schritt – ein Hundertstel Breitengrad. */
const STEP = 0.01;

describe('analyzeTrack', () => {
  it('liefert für eine leere Spur lauter Nullen', () => {
    expect(analyzeTrack([])).toEqual(EMPTY_ANALYSIS);
  });

  it('misst Strecke, Dauer und Durchschnitt', () => {
    // Zwei Abschnitte à ~1,11 km in je 5 Minuten – zusammen 10 Minuten.
    const track = [
      point(52, 13, T, 12),
      point(52 + STEP, 13, T + 300_000, 14),
      point(52 + 2 * STEP, 13, T + 600_000, 13)
    ];

    const stats = analyzeTrack(track);

    expect(stats.pointCount).toBe(3);
    expect(stats.distanceKm).toBeCloseTo(2.22, 1);
    expect(stats.durationMs).toBe(600_000);
    expect(stats.startedAt).toBe(T);
    expect(stats.endedAt).toBe(T + 600_000);
    // 2,22 km in 10 Minuten sind gut 13 km/h.
    expect(stats.avgSpeedKmh).toBeCloseTo(13.3, 0);
  });

  it('nimmt die Höchstgeschwindigkeit aus dem Messwert des Geräts', () => {
    const stats = analyzeTrack([
      point(52, 13, T, 8),
      point(52 + STEP, 13, T + 60_000, 31.5),
      point(52 + 2 * STEP, 13, T + 120_000, 9)
    ]);

    expect(stats.maxSpeedKmh).toBe(31.5);
    expect(stats.maxSpeedAt).toBe(T + 60_000);
  });

  it('zählt eine Pause nicht als Fahrzeit', () => {
    // Fahren, eine Stunde am selben Ort stehen, weiterfahren.
    const stats = analyzeTrack([
      point(52, 13, T, 20),
      point(52 + STEP, 13, T + 300_000, 20),
      point(52 + STEP, 13, T + 300_000 + 3_600_000, 0),
      point(52 + 2 * STEP, 13, T + 600_000 + 3_600_000, 20)
    ]);

    expect(stats.durationMs).toBe(600_000 + 3_600_000);
    expect(stats.movingMs).toBe(600_000);
    expect(stats.restingMs).toBe(3_600_000);
    // Der Schnitt in Fahrt ignoriert die Stunde Pause, der Gesamtschnitt nicht.
    expect(stats.movingSpeedKmh).toBeGreaterThan(stats.avgSpeedKmh * 5);
  });

  it('sortiert nachgereichte Punkte aus dem Offline-Puffer ein', () => {
    const ordered = [point(52, 13, T, 10), point(52 + STEP, 13, T + 300_000, 10)];
    const shuffled = [ordered[1], ordered[0]];

    expect(analyzeTrack(shuffled)).toEqual(analyzeTrack(ordered));
  });

  it('lässt die übergebene Liste unverändert', () => {
    const track = [point(52 + STEP, 13, T + 300_000), point(52, 13, T)];
    const copy = [...track];

    analyzeTrack(track);

    expect(track).toEqual(copy);
  });
});

describe('distanceByAuthor', () => {
  it('rechnet je Person getrennt und sortiert nach Strecke', () => {
    // Beide fahren zur selben Zeit, ihre Punkte liegen ineinander. Anna legt
    // zwei Schritte zurück, Ben einen.
    const track = [
      point(52, 13, T, 10, 'Anna'),
      point(48, 9, T + 1000, 10, 'Ben'),
      point(52 + STEP, 13, T + 60_000, 10, 'Anna'),
      point(48 + STEP, 9, T + 61_000, 10, 'Ben'),
      point(52 + 2 * STEP, 13, T + 120_000, 10, 'Anna')
    ];

    const shares = distanceByAuthor(track);

    expect(shares.map((s) => s.author)).toEqual(['Anna', 'Ben']);
    expect(shares[0].pointCount).toBe(3);
    expect(shares[1].pointCount).toBe(2);
    // Kein Sprung von Berlin nach Stuttgart: Ben bleibt bei ~1,1 km.
    expect(shares[1].distanceKm).toBeLessThan(2);
    expect(shares[0].distanceKm).toBeCloseTo(2 * shares[1].distanceKm, 1);
  });

  it('ist ohne Punkte leer', () => {
    expect(distanceByAuthor([])).toEqual([]);
  });
});

describe('speedHistogram', () => {
  it('verteilt die Messwerte auf runde Klassen', () => {
    const track = [0, 4, 9, 11, 19, 21].map((speed, i) => point(52, 13, T + i * 1000, speed));

    const buckets = speedHistogram(track, 3);

    // Höchstwert 21 auf 3 Klassen ergibt eine runde Schrittweite von 10.
    expect(buckets).toEqual([
      { fromKmh: 0, toKmh: 10, count: 3 },
      { fromKmh: 10, toKmh: 20, count: 2 },
      { fromKmh: 20, toKmh: 30, count: 1 }
    ]);
  });

  it('legt den Höchstwert in den letzten Balken statt in einen dahinter', () => {
    const track = [0, 10, 20].map((speed, i) => point(52, 13, T + i * 1000, speed));

    const buckets = speedHistogram(track, 2);

    // Klassen [0,10) und [10,20]: die 20 landet in der zweiten, nicht in einer
    // dritten, die nur diesen einen Wert enthielte.
    expect(buckets).toHaveLength(2);
    expect(buckets[1].count).toBe(2);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(3);
  });

  it('macht aus lauter Stillstand einen einzigen Balken', () => {
    const track = [point(52, 13, T), point(52, 13, T + 1000)];

    expect(speedHistogram(track)).toEqual([{ fromKmh: 0, toKmh: 0, count: 2 }]);
  });

  it('ist ohne Punkte leer', () => {
    expect(speedHistogram([])).toEqual([]);
  });
});

describe('eventCountsByType', () => {
  const event = (type: string): LogEvent => ({
    type,
    title: type,
    timestamp: T,
    author: 'Lukas',
    lat: 52,
    lng: 13
  });

  it('zählt je Kategorie, häufigste zuerst', () => {
    const counts = eventCountsByType([event('pause'), event('schleuse'), event('pause')]);

    expect(counts).toEqual([
      { type: 'pause', count: 2 },
      { type: 'schleuse', count: 1 }
    ]);
  });

  it('ist ohne Ereignisse leer', () => {
    expect(eventCountsByType([])).toEqual([]);
  });
});

describe('speedSeries', () => {
  it('gibt kurze Spuren unverändert zurück', () => {
    const track = [point(52, 13, T, 10), point(52, 13, T + 1000, 20)];

    expect(speedSeries(track, 10)).toEqual([
      { timestamp: T, speedKmh: 10 },
      { timestamp: T + 1000, speedKmh: 20 }
    ]);
  });

  it('dampft lange Spuren auf die gewünschte Zahl von Werten ein', () => {
    const track = Array.from({ length: 500 }, (_, i) => point(52, 13, T + i * 1000, i % 20));

    const samples = speedSeries(track, 50);

    expect(samples).toHaveLength(50);
    expect(samples[0].timestamp).toBeGreaterThanOrEqual(T);
    expect(samples[49].timestamp).toBeLessThanOrEqual(T + 499_000);
    // Zeitlich aufsteigend, damit die Linie nicht zurückspringt.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].timestamp).toBeGreaterThan(samples[i - 1].timestamp);
    }
  });

  it('ist ohne Punkte leer', () => {
    expect(speedSeries([])).toEqual([]);
  });
});
