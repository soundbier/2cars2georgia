import { GpsPoint, LogEvent } from '../types';
import { distanceMeters } from './geo';

/**
 * Auswertung der gespeicherten Fahrdaten.
 *
 * Der Roadtrip speichert unterwegs nur Rohdaten: Trackpunkte mit Zeit, Ort,
 * Geschwindigkeit und Autor (siehe types.ts) sowie Logbuch-Ereignisse. Alles,
 * was die Statistik-Seite zeigt, wird hier daraus gerechnet – nichts davon
 * liegt zusätzlich in Firestore. Das ist Absicht: Eine mitgeschriebene
 * Kennzahl veraltet, sobald ein Punkt nachträglich aus dem Offline-Puffer
 * eintrifft (siehe lib/trackBuffer.ts), die gerechnete nicht.
 *
 * Alle Funktionen sind rein und arbeiten auf einfachen Arrays – so lassen sie
 * sich testen, ohne Firestore oder React zu kennen.
 */

/**
 * Ab dieser Geschwindigkeit gilt ein Abschnitt als gefahren.
 *
 * Darunter liegt kein Weg, sondern das Zittern des GPS-Empfängers: Ein Boot am
 * Steg oder ein Auto an der Ampel erzeugt weiter Punkte, die ein paar Meter
 * auseinanderliegen. Ohne diese Schwelle wäre jede Pause „Fahrzeit" und die
 * Durchschnittsgeschwindigkeit in Fahrt wertlos.
 */
export const MOVING_THRESHOLD_KMH = 2;

export interface TrackAnalysis {
  pointCount: number;
  distanceKm: number;
  /** Vom ersten bis zum letzten Punkt – Pausen eingeschlossen. */
  durationMs: number;
  /** Nur die Abschnitte oberhalb von MOVING_THRESHOLD_KMH. */
  movingMs: number;
  /** Der Rest: gestanden, während die Aufzeichnung lief. */
  restingMs: number;
  /** Strecke geteilt durch Gesamtdauer. */
  avgSpeedKmh: number;
  /** Strecke geteilt durch Fahrzeit – „wie schnell, wenn es voranging". */
  movingSpeedKmh: number;
  /** Höchster gemessener Wert des Empfängers, nicht der gerechnete. */
  maxSpeedKmh: number;
  /** Zeitpunkt der Höchstgeschwindigkeit, null ohne Punkte. */
  maxSpeedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
}

export const EMPTY_ANALYSIS: TrackAnalysis = {
  pointCount: 0,
  distanceKm: 0,
  durationMs: 0,
  movingMs: 0,
  restingMs: 0,
  avgSpeedKmh: 0,
  movingSpeedKmh: 0,
  maxSpeedKmh: 0,
  maxSpeedAt: null,
  startedAt: null,
  endedAt: null
};

/**
 * Die Punkte chronologisch – als Kopie, damit die Liste des Aufrufers (und
 * damit der Firestore-Cache dahinter) unangetastet bleibt.
 *
 * Sortiert kommen die Punkte zwar aus der Abfrage, aber nicht zwangsläufig
 * aus dem Offline-Puffer: Der schiebt nachgeholte Punkte hinterher, sobald
 * wieder Netz da ist.
 */
function chronological(points: GpsPoint[]): GpsPoint[] {
  return [...points].sort((a, b) => a.timestamp - b.timestamp);
}

/** Endlicher, nicht negativer Messwert – oder 0. */
function safeSpeed(speedKmh: number | undefined): number {
  return typeof speedKmh === 'number' && Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : 0;
}

/**
 * Alle Kennzahlen einer Punktfolge auf einmal.
 *
 * Bewusst ein Durchlauf statt fünf einzelner Funktionen: Strecke, Fahrzeit und
 * Höchstwert hängen an denselben Abschnitten, und die Spur eines mehrwöchigen
 * Roadtrips hat zehntausende Punkte.
 */
export function analyzeTrack(points: GpsPoint[]): TrackAnalysis {
  if (points.length === 0) return EMPTY_ANALYSIS;

  const sorted = chronological(points);
  let meters = 0;
  let movingMs = 0;
  let maxSpeedKmh = safeSpeed(sorted[0].speedKmh);
  let maxSpeedAt = sorted[0].timestamp;

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const segmentMeters = distanceMeters(previous, current);
    const segmentMs = current.timestamp - previous.timestamp;
    meters += segmentMeters;

    // Aus Weg und Zeit gerechnet, nicht aus dem Messwert des Geräts: Ein
    // einzelner Ausreißer im Tempo soll nicht ganze Minuten zu „Fahrzeit"
    // machen, und Punkte aus alten Aufzeichnungen tragen manchmal gar keine
    // brauchbare Geschwindigkeit.
    if (segmentMs > 0) {
      const segmentKmh = (segmentMeters / 1000) / (segmentMs / 3_600_000);
      if (segmentKmh >= MOVING_THRESHOLD_KMH) movingMs += segmentMs;
    }

    const speed = safeSpeed(current.speedKmh);
    if (speed > maxSpeedKmh) {
      maxSpeedKmh = speed;
      maxSpeedAt = current.timestamp;
    }
  }

  const startedAt = sorted[0].timestamp;
  const endedAt = sorted[sorted.length - 1].timestamp;
  const durationMs = Math.max(0, endedAt - startedAt);
  const distanceKm = meters / 1000;
  const hours = durationMs / 3_600_000;
  const movingHours = movingMs / 3_600_000;

  return {
    pointCount: sorted.length,
    distanceKm,
    durationMs,
    movingMs,
    restingMs: Math.max(0, durationMs - movingMs),
    avgSpeedKmh: hours > 0 ? distanceKm / hours : 0,
    movingSpeedKmh: movingHours > 0 ? distanceKm / movingHours : 0,
    maxSpeedKmh,
    maxSpeedAt,
    startedAt,
    endedAt
  };
}

export interface AuthorShare {
  author: string;
  distanceKm: number;
  pointCount: number;
}

/**
 * Wer wie viel gefahren ist – längste Strecke zuerst.
 *
 * Erst gruppieren, dann messen: Die Spur des Roadtrips enthält die Punkte
 * aller Geräte ineinander verschachtelt. Würde man einfach von Punkt zu Punkt
 * rechnen, entstünde bei jedem Wechsel zwischen zwei Fahrzeugen ein Sprung
 * quer über die Landkarte.
 */
export function distanceByAuthor(points: GpsPoint[]): AuthorShare[] {
  const byAuthor = new Map<string, GpsPoint[]>();
  for (const point of points) {
    const bucket = byAuthor.get(point.author);
    if (bucket) bucket.push(point);
    else byAuthor.set(point.author, [point]);
  }

  return Array.from(byAuthor.entries())
    .map(([author, ownPoints]) => {
      const { distanceKm, pointCount } = analyzeTrack(ownPoints);
      return { author, distanceKm, pointCount };
    })
    .sort((a, b) => b.distanceKm - a.distanceKm || a.author.localeCompare(b.author));
}

export interface SpeedBucket {
  /** Untergrenze in km/h, einschließlich. */
  fromKmh: number;
  /** Obergrenze in km/h, ausschließlich – beim letzten Balken einschließlich. */
  toKmh: number;
  count: number;
}

/** Runde Schrittweite („1, 2, 5, 10, 20, 50 …") für die Balkenbreite. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Verteilung der gemessenen Geschwindigkeiten über runde Klassen.
 *
 * Beantwortet die Frage, die ein Durchschnitt verschluckt: Waren es
 * gleichmäßige 12 km/h oder ständiger Wechsel zwischen Stillstand und
 * Vollgas? Gezählt wird der Messwert des Empfängers – das ist die
 * Geschwindigkeit, die tatsächlich in Firestore steht.
 */
export function speedHistogram(points: GpsPoint[], bucketCount = 6): SpeedBucket[] {
  if (points.length === 0 || bucketCount < 1) return [];

  const speeds = points.map((point) => safeSpeed(point.speedKmh));
  const max = Math.max(...speeds);
  // Alles stand: ein einziger Balken statt einer Achse ohne Spannweite.
  if (max <= 0) return [{ fromKmh: 0, toKmh: 0, count: speeds.length }];

  const step = niceStep(max / bucketCount);
  const buckets: SpeedBucket[] = [];
  for (let from = 0; from < max; from += step) {
    buckets.push({ fromKmh: from, toKmh: from + step, count: 0 });
  }

  for (const speed of speeds) {
    // Der Höchstwert selbst gehört in den letzten Balken, nicht in einen
    // zusätzlichen dahinter.
    const index = Math.min(buckets.length - 1, Math.floor(speed / step));
    buckets[index].count += 1;
  }

  return buckets;
}

export interface TypeCount {
  type: string;
  count: number;
}

/** Wie oft welche Logbuch-Kategorie vorkam – häufigste zuerst. */
export function eventCountsByType(events: LogEvent[]): TypeCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export interface SpeedSample {
  timestamp: number;
  speedKmh: number;
}

/**
 * Der Geschwindigkeitsverlauf, auf höchstens `maxSamples` Werte eingedampft.
 *
 * Eine Tagesfahrt mit 10-Sekunden-Takt liefert tausende Punkte; als Linie auf
 * 300 Bildschirmpunkten ist davon nichts zu erkennen und alles zu rendern.
 * Gemittelt wird über gleich große Abschnitte der Punktfolge, damit die Form
 * der Kurve erhalten bleibt – der Höchstwert steht als eigene Kennzahl daneben
 * und geht durch das Mitteln nicht verloren.
 */
export function speedSeries(points: GpsPoint[], maxSamples = 120): SpeedSample[] {
  if (points.length === 0) return [];
  const sorted = chronological(points);
  if (sorted.length <= maxSamples) {
    return sorted.map((point) => ({ timestamp: point.timestamp, speedKmh: safeSpeed(point.speedKmh) }));
  }

  const size = sorted.length / maxSamples;
  const samples: SpeedSample[] = [];
  for (let i = 0; i < maxSamples; i++) {
    const start = Math.floor(i * size);
    const end = Math.max(start + 1, Math.floor((i + 1) * size));
    let sum = 0;
    for (let j = start; j < end; j++) sum += safeSpeed(sorted[j].speedKmh);
    samples.push({
      timestamp: sorted[Math.floor((start + end - 1) / 2)].timestamp,
      speedKmh: sum / (end - start)
    });
  }
  return samples;
}
