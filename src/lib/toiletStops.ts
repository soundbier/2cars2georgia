/**
 * Toilettenstopps: Katalog, Schlüssel und Auswertung.
 *
 * Bewusst zwei Collections statt einer (siehe firestore.rules und README):
 *
 * * `roadtrips/{tripId}/toiletStops` – der Marker. Wann, wo, von wem, was für
 *   eine Örtlichkeit. Sichtbar für die ganze Crew, denn genau das nützt
 *   gemeinsam: Wo gab es unterwegs überhaupt eine Toilette?
 * * `roadtrips/{tripId}/toiletDetails` – die Beschreibung nach der
 *   Bristol-Skala, unter derselben Dokument-Id. Liest und schreibt nur, wer
 *   sie angelegt hat.
 *
 * Der Grund für die Teilung ist keine Vorliebe, sondern Firestore: Leserechte
 * gelten pro Dokument, nicht pro Feld. Stünde der Bristol-Typ im selben
 * Dokument wie der Marker, wäre er für jedes Crewmitglied mitlesbar – auch
 * wenn die Oberfläche ihn verstecken würde.
 *
 * Gerechnet wird hier, gespeichert nichts: Zähler und Verteilung entstehen
 * bei jedem Rendern neu aus den Dokumenten (wie in lib/statistics.ts).
 */

import type { TranslationKey } from '../i18n/translate';
import { dayKey } from './dayRecap';
import { BristolType, ToiletDetail, ToiletPlaceType, ToiletStop } from '../types';

/** Name der öffentlichen Collection – auch der Papierkorb greift darauf zu. */
export const TOILET_STOPS = 'toiletStops';

/** Name der privaten Collection mit den Beschreibungen. */
export const TOILET_DETAILS = 'toiletDetails';

export const BRISTOL_TYPES: BristolType[] = [1, 2, 3, 4, 5, 6, 7];

/** Vorbelegung des Dropdowns: Typ 4 ist die Mitte der Skala. */
export const DEFAULT_BRISTOL_TYPE: BristolType = 4;

export const TOILET_PLACE_TYPES: ToiletPlaceType[] = [
  'gasStation',
  'restaurant',
  'nature',
  'campsite',
  'publicToilet',
  'accommodation',
  'vehicle',
  'other'
];

/** Vorbelegung des Ort-Dropdowns – der häufigste Halt auf einer Autoreise. */
export const DEFAULT_PLACE_TYPE: ToiletPlaceType = 'gasStation';

/**
 * Beschriftungen als feste Zuordnung statt zusammengesetzter Schlüssel:
 * So prüft der Typecheck, dass es jeden Text wirklich gibt (siehe i18n/de.ts).
 */
const BRISTOL_LABEL_KEYS: Record<BristolType, TranslationKey> = {
  1: 'toilets.bristol.1',
  2: 'toilets.bristol.2',
  3: 'toilets.bristol.3',
  4: 'toilets.bristol.4',
  5: 'toilets.bristol.5',
  6: 'toilets.bristol.6',
  7: 'toilets.bristol.7'
};

const PLACE_LABEL_KEYS: Record<ToiletPlaceType, TranslationKey> = {
  gasStation: 'toilets.place.gasStation',
  restaurant: 'toilets.place.restaurant',
  nature: 'toilets.place.nature',
  campsite: 'toilets.place.campsite',
  publicToilet: 'toilets.place.publicToilet',
  accommodation: 'toilets.place.accommodation',
  vehicle: 'toilets.place.vehicle',
  other: 'toilets.place.other'
};

export function bristolLabelKey(type: BristolType): TranslationKey {
  return BRISTOL_LABEL_KEYS[type];
}

export function placeLabelKey(type: ToiletPlaceType): TranslationKey {
  return PLACE_LABEL_KEYS[type];
}

/**
 * Grobe Einordnung der sieben Typen: 1–2 zu fest, 3–4 im Rahmen, 5–7 zu
 * weich. Mehr sagt die Skala nicht aus, und mehr soll die App auch nicht
 * behaupten – eine Diagnose ist das nicht.
 */
export type BristolTendency = 'hard' | 'normal' | 'soft';

const TENDENCY_LABEL_KEYS: Record<BristolTendency, TranslationKey> = {
  hard: 'toilets.tendency.hard',
  normal: 'toilets.tendency.normal',
  soft: 'toilets.tendency.soft'
};

export function bristolTendency(type: BristolType): BristolTendency {
  if (type <= 2) return 'hard';
  if (type <= 4) return 'normal';
  return 'soft';
}

export function tendencyLabelKey(tendency: BristolTendency): TranslationKey {
  return TENDENCY_LABEL_KEYS[tendency];
}

export function isBristolType(value: unknown): value is BristolType {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

export function isToiletPlaceType(value: unknown): value is ToiletPlaceType {
  return typeof value === 'string' && (TOILET_PLACE_TYPES as string[]).includes(value);
}

let counter = 0;

/**
 * Id für einen neuen Stopp. Marker und Beschreibung teilen sie sich – anders
 * fänden sie nach dem Speichern nicht mehr zueinander, denn ein einzelner
 * Schreibvorgang über zwei Collections ist offline nicht zu haben.
 */
export function createToiletStopId(): string {
  counter += 1;
  return `wc-${Date.now().toString(36)}-${counter}`;
}

export interface AuthorCount {
  author: string;
  count: number;
}

/** Wie oft jede Person angehalten hat, die häufigste zuerst. */
export function countsByAuthor(stops: ToiletStop[]): AuthorCount[] {
  const byAuthor = new Map<string, number>();
  for (const stop of stops) {
    byAuthor.set(stop.author, (byAuthor.get(stop.author) ?? 0) + 1);
  }
  return Array.from(byAuthor.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}

/**
 * Stopps je Reisetag – gezählt werden nur Tage, an denen überhaupt etwas
 * eingetragen wurde. Ein Schnitt über alle Kalendertage seit Reisebeginn
 * hinge sonst daran, ob jemand den Reisezeitraum gepflegt hat, und wäre nach
 * einer Pause plötzlich halb so hoch.
 */
export function averagePerDay(stops: ToiletStop[]): number {
  if (stops.length === 0) return 0;
  const days = new Set(stops.map((stop) => dayKey(stop.timestamp)));
  return stops.length / days.size;
}

export interface BristolCount {
  type: BristolType;
  count: number;
}

/** Verteilung über die sieben Typen, immer vollständig – auch die Nullen. */
export function bristolCounts(details: ToiletDetail[]): BristolCount[] {
  const byType = new Map<BristolType, number>();
  for (const detail of details) {
    if (!isBristolType(detail.bristolType)) continue;
    byType.set(detail.bristolType, (byType.get(detail.bristolType) ?? 0) + 1);
  }
  return BRISTOL_TYPES.map((type) => ({ type, count: byType.get(type) ?? 0 }));
}

/**
 * Der am häufigsten eingetragene Typ, oder null solange nichts beschrieben
 * ist. Bei Gleichstand gewinnt der niedrigere Typ – irgendeine Regel braucht
 * es, und so ist sie wenigstens vorhersehbar.
 */
export function dominantBristolType(details: ToiletDetail[]): BristolType | null {
  let best: BristolCount | null = null;
  for (const entry of bristolCounts(details)) {
    if (entry.count > 0 && (!best || entry.count > best.count)) best = entry;
  }
  return best?.type ?? null;
}
