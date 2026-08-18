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

// Fallback, solange settings/quicklogs in Firestore noch nicht existiert.
export const DEFAULT_QUICK_LOGS: QuickLogConfig[] = [
  { id: 'schleuse', label: 'Schleuse', iconName: 'anchor' },
  { id: 'pause', label: 'Pause', iconName: 'coffee' },
  { id: 'anlegen', label: 'Anlegen', iconName: 'home' },
  { id: 'grenze', label: 'Grenze', iconName: 'map-pin' },
  { id: 'panne', label: 'Panne', iconName: 'alert-triangle' }
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
