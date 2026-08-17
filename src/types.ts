export const APP_USERS = ['Lukas', 'Leon', 'Niklas', 'Elias'];

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
