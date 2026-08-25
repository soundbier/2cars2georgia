import { describe, expect, it } from 'vitest';
import {
  averagePerDay,
  bristolCounts,
  bristolTendency,
  countsByAuthor,
  createToiletStopId,
  dominantBristolType,
  isBristolType,
  isToiletPlaceType
} from './toiletStops';
import { BristolType, ToiletDetail, ToiletStop } from '../types';

const DAY_ONE = new Date(2026, 4, 4, 10, 0).getTime();
const DAY_TWO = new Date(2026, 4, 5, 10, 0).getTime();

function stop(author: string, timestamp: number): ToiletStop {
  return { timestamp, author, authorId: `uid-${author}`, lat: 41.7, lng: 44.8, placeType: 'gasStation' };
}

function detail(bristolType: number): ToiletDetail {
  return { authorId: 'uid-a', bristolType: bristolType as ToiletDetail['bristolType'] };
}

describe('countsByAuthor', () => {
  it('zählt je Person und stellt die häufigste nach vorn', () => {
    const counts = countsByAuthor([
      stop('Anna', DAY_ONE),
      stop('Ben', DAY_ONE),
      stop('Anna', DAY_TWO)
    ]);
    expect(counts).toEqual([
      { author: 'Anna', count: 2 },
      { author: 'Ben', count: 1 }
    ]);
  });

  it('sortiert bei Gleichstand nach Namen, damit die Liste nicht springt', () => {
    const counts = countsByAuthor([stop('Ben', DAY_ONE), stop('Anna', DAY_ONE)]);
    expect(counts.map((entry) => entry.author)).toEqual(['Anna', 'Ben']);
  });
});

describe('averagePerDay', () => {
  it('teilt nur durch Tage, an denen etwas eingetragen wurde', () => {
    // Drei Stopps an zwei Tagen – die Tage dazwischen ohne Eintrag zählen
    // nicht mit, sonst sänke der Schnitt nach jeder Pause.
    const average = averagePerDay([
      stop('Anna', DAY_ONE),
      stop('Ben', DAY_ONE),
      stop('Anna', DAY_TWO)
    ]);
    expect(average).toBeCloseTo(1.5);
  });

  it('bleibt ohne Einträge bei null', () => {
    expect(averagePerDay([])).toBe(0);
  });
});

describe('bristolCounts', () => {
  it('liefert immer alle sieben Typen, auch die leeren', () => {
    const counts = bristolCounts([detail(4), detail(4), detail(1)]);
    expect(counts).toHaveLength(7);
    expect(counts.map((entry) => entry.count)).toEqual([1, 0, 0, 2, 0, 0, 0]);
  });

  it('übergeht Datensätze außerhalb der Skala', () => {
    const counts = bristolCounts([detail(0), detail(8), detail(3)]);
    expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(1);
  });
});

describe('dominantBristolType', () => {
  it('nennt den häufigsten Typ', () => {
    expect(dominantBristolType([detail(6), detail(6), detail(2)])).toBe(6);
  });

  it('entscheidet Gleichstand für den niedrigeren Typ', () => {
    expect(dominantBristolType([detail(2), detail(5)])).toBe(2);
  });

  it('liefert null, solange nichts beschrieben ist', () => {
    expect(dominantBristolType([])).toBeNull();
  });
});

describe('bristolTendency', () => {
  it('teilt die Skala in fest, im Rahmen und weich', () => {
    const tendencies = ([1, 2, 3, 4, 5, 6, 7] as BristolType[]).map(bristolTendency);
    expect(tendencies).toEqual(['hard', 'hard', 'normal', 'normal', 'soft', 'soft', 'soft']);
  });
});

describe('Wertprüfungen', () => {
  it('erkennt gültige Bristol-Typen', () => {
    expect(isBristolType(1)).toBe(true);
    expect(isBristolType(7)).toBe(true);
    expect(isBristolType(0)).toBe(false);
    expect(isBristolType(8)).toBe(false);
    expect(isBristolType(3.5)).toBe(false);
    expect(isBristolType('4')).toBe(false);
  });

  it('erkennt gültige Örtlichkeiten', () => {
    expect(isToiletPlaceType('campsite')).toBe(true);
    expect(isToiletPlaceType('bahnhof')).toBe(false);
  });
});

describe('createToiletStopId', () => {
  it('vergibt für Marker und Beschreibung unterscheidbare Schlüssel', () => {
    const ids = new Set([createToiletStopId(), createToiletStopId(), createToiletStopId()]);
    expect(ids.size).toBe(3);
  });
});
