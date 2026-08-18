/**
 * Einheiten-Umrechnung für Geschwindigkeit und Strecke.
 *
 * Intern rechnet und speichert die App durchgehend metrisch (km/h, km) – die
 * Firestore-Dokumente bleiben dadurch unverändert. Die Umrechnung passiert
 * ausschließlich bei der Anzeige.
 */
export type UnitSystem = 'metric' | 'nautical';

const KNOTS_PER_KMH = 0.539957;
const KM_PER_NAUTICAL_MILE = 1.852;

export const speedUnitLabel = (system: UnitSystem) => (system === 'nautical' ? 'kn' : 'km/h');

export const distanceUnitLabel = (system: UnitSystem) => (system === 'nautical' ? 'sm' : 'km');

export const toDisplaySpeed = (speedKmh: number, system: UnitSystem) =>
  system === 'nautical' ? speedKmh * KNOTS_PER_KMH : speedKmh;

export const toDisplayDistance = (distanceKm: number, system: UnitSystem) =>
  system === 'nautical' ? distanceKm / KM_PER_NAUTICAL_MILE : distanceKm;

/** Fertig formatierter Wert inklusive Einheit, z. B. "12.4 kn". */
export const formatSpeed = (speedKmh: number, system: UnitSystem, digits = 1) =>
  `${toDisplaySpeed(speedKmh, system).toFixed(digits)} ${speedUnitLabel(system)}`;

export const formatDistance = (distanceKm: number, system: UnitSystem, digits = 1) =>
  `${toDisplayDistance(distanceKm, system).toFixed(digits)} ${distanceUnitLabel(system)}`;
