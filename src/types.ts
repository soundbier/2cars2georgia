// Kategorie-Id eines Log-Ereignisses. Entspricht der id einer QuickLogConfig
// (siehe unten) oder einem der ursprünglichen, fest codierten Werte aus
// bereits bestehenden Firestore-Dokumenten ("gps", "tanken", "pegel" …).
export type LogType = string;

// Verfügbare Icons für Schnell-Logs. Bewusst klein gehalten und auf
// vorhandene lucide-react-Icons abgebildet (siehe quickLogIcons.tsx).
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

export interface GpsPoint {
  id?: string;
  timestamp: number;
  author: string;
  lat: number;
  lng: number;
  speedKmh: number;
}

export interface LogEvent {
  id?: string;
  timestamp: number;
  author: string;
  type: LogType;
  lat: number;
  lng: number;
  title: string;
  note?: string;
}

export interface Expense {
  id?: string;
  timestamp: number;
  author: string;
  paidBy: string;
  title: string;
  amountEuro: number;
  category: 'tanken' | 'liegeplatz' | 'schleuse' | 'verpflegung' | 'sonstiges';
}

export const USER_COLORS: Record<string, string> = {
  'Lukas': '#f59e0b', // Amber / Orange
  'Leon': '#0ea5e9',  // Cyan
  'Niklas': '#10b981',// Green
  'Elias': '#8b5cf6'  // Purple
};
// Fallback-Farbe für neue Nutzer
export const DEFAULT_USER_COLOR = '#ef4444';
