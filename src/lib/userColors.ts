/**
 * Farbzuordnung für Crewmitglieder.
 *
 * Die Crew-Liste wird zur Laufzeit in Firebase gepflegt, deshalb darf hier
 * keine feste Namensliste stehen. Die Farbe wird stattdessen deterministisch
 * aus dem Namen abgeleitet: gleicher Name → gleiche Farbe auf allen Geräten,
 * ohne dass neue Crewmitglieder gepflegt werden müssen.
 *
 * Die Palette stammt aus derselben Farbwelt wie der Rest der App (siehe
 * styles/tokens.css, Abschnitt „Crew-Farben") – vorher lief hier eine eigene,
 * viel buntere Reihe, die neben dem übrigen UI wie aus einer anderen App
 * aussah. Zwei Bedingungen gelten für jeden Ton:
 *
 * 1. Weiß muss darauf lesbar sein (mind. 4.5:1), denn die Farbe trägt das
 *    weiße Initial im Avatar und die Positionsmarker auf der Karte.
 * 2. Die Töne müssen sich in der Farbe unterscheiden, nicht nur in der
 *    Helligkeit – nebeneinander stehen sie als kleine Kreise.
 *
 * Die Werte stehen hier als Literale, weil sie auch außerhalb von CSS
 * gebraucht werden: Leaflet setzt Markerfarben als SVG-Attribut, dort werden
 * CSS-Variablen nicht aufgelöst. Sie sind mit den `--crew-*`-Tokens identisch
 * und müssen mit ihnen zusammen geändert werden.
 */
const USER_COLOR_PALETTE = [
  '#bc4f27', // Terracotta
  '#2a7f87', // Türkis
  '#6b7a3f', // Oliv
  '#96661c', // Ocker
  '#a32e20', // Rost
  '#2f4468', // Navy
  '#5b7360', // Salbei
  '#74685a' // Sand
];

export function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return USER_COLOR_PALETTE[hash % USER_COLOR_PALETTE.length];
}
