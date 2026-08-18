import { describe, expect, it } from 'vitest';
import { bearingDegrees, distanceMeters } from './geo';

// Referenzwerte stammen aus der Haversine-/Great-Circle-Formel; die Toleranzen
// sind so gewählt, dass sie echte Rechenfehler fangen, aber nicht an der
// Gleitkomma-Genauigkeit scheitern.
describe('distanceMeters', () => {
  it('liefert 0 für denselben Punkt', () => {
    const p = { lat: 52.52, lng: 13.405 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('rechnet einen Breitengrad Abstand in rund 111 km um', () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_500);
  });

  it('misst Berlin–Hamburg mit rund 255 km', () => {
    const d = distanceMeters({ lat: 52.52, lng: 13.405 }, { lat: 53.5511, lng: 9.9937 });
    expect(d / 1000).toBeCloseTo(255, 0);
  });

  it('ist symmetrisch', () => {
    const a = { lat: 48.137, lng: 11.575 };
    const b = { lat: 50.11, lng: 8.682 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it('bleibt über den Datumsgrenze-Sprung hinweg klein', () => {
    // 179.9°E und 179.9°W liegen nur gut 20 km auseinander, obwohl sich die
    // Längengrade numerisch um fast 360° unterscheiden.
    const d = distanceMeters({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
    expect(d).toBeLessThan(25_000);
  });
});

describe('bearingDegrees', () => {
  it('zeigt nach Norden', () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 3);
  });

  it('zeigt nach Osten', () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 3);
  });

  it('zeigt nach Süden', () => {
    expect(bearingDegrees({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180, 3);
  });

  it('zeigt nach Westen', () => {
    expect(bearingDegrees({ lat: 0, lng: 1 }, { lat: 0, lng: 0 })).toBeCloseTo(270, 3);
  });

  it('liefert immer einen Wert zwischen 0 und 360', () => {
    // Ein negativer atan2-Rückgabewert darf nicht als negativer Kurs
    // durchschlagen – die Karte würde das Boot sonst falsch herum drehen.
    const westwaerts = bearingDegrees({ lat: 10, lng: 10 }, { lat: 9, lng: 9 });
    expect(westwaerts).toBeGreaterThanOrEqual(0);
    expect(westwaerts).toBeLessThan(360);
    expect(westwaerts).toBeGreaterThan(180);
  });
});
