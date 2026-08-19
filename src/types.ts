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
  | 'tag'
  | 'ship'
  | 'utensils'
  | 'camera'
  | 'wrench'
  | 'shopping-cart'
  | 'compass'
  | 'sun'
  | 'users';

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

// Bewusst gibt es KEINE vorgegebene Crew-Liste: Ein frisch angelegter
// Roadtrip startet ohne Mitglieder, und jede Person trägt sich beim ersten
// Start selbst ein (siehe CrewGate in App.tsx). Vorher standen hier vier
// feste Vornamen, die in jedem fremden Roadtrip auftauchten und erst von
// Hand gelöscht werden mussten.

/**
 * Rolle eines Crewmitglieds innerhalb des Roadtrips, siehe lib/permissions.ts:
 * - owner: darf die Crew verwalten (einladen, entfernen, Rollen vergeben).
 * - member: normales Crewmitglied ("Mitfahrer"), erfasst/bearbeitet Einträge.
 * - readonly: sieht alles, kann aber nichts anlegen, ändern oder löschen.
 */
export type CrewRole = 'owner' | 'member' | 'readonly';

/**
 * Rollenzuordnung im settings/general-Dokument. Ein fehlender Eintrag ist
 * kein Fehler – getEffectiveRole() in lib/permissions.ts liefert dafür einen
 * sinnvollen Standard, damit bestehende Roadtrips ohne dieses Feld weiter
 * funktionieren.
 */
export type CrewRoles = Partial<Record<string, CrewRole>>;

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
