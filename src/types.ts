import type { TranslationKey } from './i18n/translate';

// Kategorie-Id eines Log-Ereignisses. Entspricht der id einer QuickLogConfig
// oder einem der ursprünglichen, fest codierten Werte aus bereits
// bestehenden Firestore-Dokumenten ("gps", "tanken", "pegel" …).
export type LogType = string;

// Verfügbare Icons für Schnell-Logs. Bewusst klein gehalten und auf
// vorhandene lucide-react-Icons abgebildet (siehe lib/quickLogIcons.tsx).
export type QuickLogIconName =
  | 'anchor'
  | 'coffee'
  | 'alert-triangle'
  | 'map-pin'
  | 'home'
  | 'fuel'
  | 'gauge'
  | 'tag';

export interface QuickLogConfig {
  id: string;
  label: string;
  iconName: QuickLogIconName;
}

/**
 * Vorlage für settings/quicklogs, solange das Dokument in Firestore noch nicht
 * existiert.
 *
 * Statt fertiger Beschriftungen steht hier ein Übersetzungsschlüssel: Legt
 * jemand mit englischer Oberfläche einen Roadtrip an, sollen die ersten
 * Schnell-Logs nicht auf Deutsch erscheinen. Ab dem Anlegen sind es dann
 * normale, von der Crew änderbare Daten – ein späterer Sprachwechsel benennt
 * bestehende Kategorien bewusst nicht um.
 */
export interface QuickLogSeed {
  id: string;
  labelKey: TranslationKey;
  iconName: QuickLogIconName;
}

export const DEFAULT_QUICK_LOG_SEEDS: QuickLogSeed[] = [
  { id: 'schleuse', labelKey: 'quickLogs.default.schleuse', iconName: 'anchor' },
  { id: 'pause', labelKey: 'quickLogs.default.pause', iconName: 'coffee' },
  { id: 'anlegen', labelKey: 'quickLogs.default.anlegen', iconName: 'home' },
  { id: 'grenze', labelKey: 'quickLogs.default.grenze', iconName: 'map-pin' },
  { id: 'panne', labelKey: 'quickLogs.default.panne', iconName: 'alert-triangle' }
];

// Fallback, solange settings/general in Firestore noch nicht existiert.
export const DEFAULT_USERS = ['Lukas', 'Leon', 'Niklas', 'Elias'];

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Momentaufnahme des GPS-Empfängers, noch ohne Bezug zu Nutzer/Zeit. */
export interface LivePosition extends Coordinates {
  speedKmh: number;
  /**
   * Fahrtrichtung in Grad (0 = Nord, im Uhrzeigersinn), oder null solange sie
   * unbekannt ist – im Stand oder direkt nach dem ersten Fix liefert das Gerät
   * keinen verwertbaren Kurs.
   */
  headingDeg: number | null;
}

export interface GpsPoint extends LivePosition {
  id?: string;
  timestamp: number;
  author: string;
}

export interface LogEvent extends Coordinates {
  id?: string;
  timestamp: number;
  author: string;
  type: LogType;
  title: string;
  note?: string;
  /**
   * Gesetzt, sobald der Eintrag im Papierkorb liegt – siehe lib/trash.ts.
   * Gelöscht wird bewusst weich, damit ein Fehlgriff rückgängig gemacht
   * werden kann.
   */
  deletedAt?: number;
}

export type ExpenseCategory = 'tanken' | 'liegeplatz' | 'schleuse' | 'verpflegung' | 'sonstiges';

export interface Expense {
  id?: string;
  timestamp: number;
  author: string;
  paidBy: string;
  title: string;
  amountEuro: number;
  category: ExpenseCategory;
  /** Gesetzt, sobald die Ausgabe im Papierkorb liegt – siehe lib/trash.ts. */
  deletedAt?: number;
}
