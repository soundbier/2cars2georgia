export type LogType = 
  | 'gps'
  | 'schleuse'
  | 'pause'
  | 'panne'
  | 'grenze'
  | 'tanken'
  | 'anlegen'
  | 'pegel';

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
