import {
  Anchor,
  Coffee,
  AlertTriangle,
  MapPin,
  Home,
  Fuel,
  Gauge,
  Tag,
  Ship,
  Utensils,
  Camera,
  Wrench,
  ShoppingCart,
  Compass,
  Sun,
  Users,
  LucideIcon
} from 'lucide-react';
import { QuickLogIconName } from '../types';
import { DEFAULT_QUICK_LOG_ICON } from './quickLogIconShapes';

export const QUICK_LOG_ICONS: Record<QuickLogIconName, LucideIcon> = {
  anchor: Anchor,
  coffee: Coffee,
  'alert-triangle': AlertTriangle,
  'map-pin': MapPin,
  home: Home,
  fuel: Fuel,
  gauge: Gauge,
  tag: Tag,
  ship: Ship,
  utensils: Utensils,
  camera: Camera,
  wrench: Wrench,
  'shopping-cart': ShoppingCart,
  compass: Compass,
  sun: Sun,
  users: Users
};

// Steht bei der Geometrie fürs Tagesbild, damit Oberfläche und Bild bei einer
// unbekannten Kategorie dasselbe Ersatz-Icon zeigen.
export { DEFAULT_QUICK_LOG_ICON };

export function getQuickLogIcon(name?: string): LucideIcon {
  return QUICK_LOG_ICONS[name as QuickLogIconName] ?? QUICK_LOG_ICONS[DEFAULT_QUICK_LOG_ICON];
}
