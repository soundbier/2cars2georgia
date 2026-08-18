import { describe, expect, it } from 'vitest';
import {
  distanceUnitLabel,
  formatDistance,
  formatSpeed,
  speedUnitLabel,
  toDisplayDistance,
  toDisplaySpeed
} from './units';

describe('Einheiten-Umrechnung', () => {
  it('lässt metrische Werte unverändert', () => {
    expect(toDisplaySpeed(12.5, 'metric')).toBe(12.5);
    expect(toDisplayDistance(42, 'metric')).toBe(42);
  });

  it('rechnet km/h in Knoten um', () => {
    expect(toDisplaySpeed(1.852, 'nautical')).toBeCloseTo(1, 3);
  });

  it('rechnet Kilometer in Seemeilen um', () => {
    expect(toDisplayDistance(1.852, 'nautical')).toBeCloseTo(1, 6);
  });

  it('benennt die Einheiten passend zum System', () => {
    expect(speedUnitLabel('metric')).toBe('km/h');
    expect(speedUnitLabel('nautical')).toBe('kn');
    expect(distanceUnitLabel('metric')).toBe('km');
    expect(distanceUnitLabel('nautical')).toBe('sm');
  });
});

describe('Formatierung', () => {
  it('hängt die Einheit an und rundet auf eine Nachkommastelle', () => {
    expect(formatSpeed(12.34, 'metric')).toBe('12.3 km/h');
    expect(formatDistance(9.87, 'metric')).toBe('9.9 km');
  });

  it('berücksichtigt die gewünschte Genauigkeit', () => {
    expect(formatSpeed(12.345, 'metric', 2)).toBe('12.35 km/h');
    expect(formatDistance(10, 'metric', 0)).toBe('10 km');
  });

  it('formatiert nautische Werte', () => {
    expect(formatSpeed(1.852, 'nautical')).toBe('1.0 kn');
    expect(formatDistance(18.52, 'nautical')).toBe('10.0 sm');
  });

  it('kommt mit 0 zurecht', () => {
    expect(formatSpeed(0, 'metric')).toBe('0.0 km/h');
    expect(formatDistance(0, 'nautical')).toBe('0.0 sm');
  });
});
