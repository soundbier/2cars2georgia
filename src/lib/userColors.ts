/**
 * Farbzuordnung für Crewmitglieder.
 *
 * Die Crew-Liste wird zur Laufzeit in Firebase gepflegt, deshalb darf hier
 * keine feste Namensliste stehen. Die Farbe wird stattdessen deterministisch
 * aus dem Namen abgeleitet: gleicher Name → gleiche Farbe auf allen Geräten,
 * ohne dass neue Crewmitglieder gepflegt werden müssen.
 */
const USER_COLOR_PALETTE = [
  '#0ea5e9', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Grün
  '#8b5cf6', // Violett
  '#ef4444', // Rot
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#6366f1' // Indigo
];

export function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return USER_COLOR_PALETTE[hash % USER_COLOR_PALETTE.length];
}
