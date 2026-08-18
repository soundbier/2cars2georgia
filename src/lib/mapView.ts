/**
 * Zuletzt betrachteter Kartenausschnitt.
 *
 * Die Karte wird beim Tab-Wechsel aus- und wieder eingehängt. Ohne diesen
 * Speicher startete sie danach jedes Mal neu über der eigenen Position –
 * wer gerade die Route voraus angesehen hat, verlor den Ausschnitt.
 *
 * Bewusst in localStorage: Der Ausschnitt soll auch einen Neustart der App
 * (oder des Geräts) an Bord überleben.
 */

const STORAGE_KEY = 'boat_map_view';

export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
  /** Drehung des Karteninhalts in Grad, 0 = Norden oben. */
  bearing: number;
  /** true, solange die Karte der eigenen Position folgt. */
  follow: boolean;
}

/** Hamburg als Startansicht, solange weder GPS noch Track vorliegen. */
export const DEFAULT_MAP_VIEW: MapView = {
  lat: 53.5511,
  lng: 9.9937,
  zoom: 13,
  bearing: 0,
  // Beim allerersten Öffnen zentriert die Karte auf die eigene Position,
  // sobald GPS verfügbar ist. Danach entscheidet der Nutzer.
  follow: true
};

// Der Ausschnitt ändert sich bei jeder Kartenbewegung. Über den Cache lesen
// wir beim erneuten Einhängen der Karte, ohne localStorage zu parsen.
let cached: MapView | null = null;

export function readMapView(): MapView {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<MapView>) : null;
    cached = { ...DEFAULT_MAP_VIEW, ...stored };
  } catch (err) {
    console.error('Kartenausschnitt konnte nicht gelesen werden:', err);
    cached = DEFAULT_MAP_VIEW;
  }
  return cached;
}

export function saveMapView(patch: Partial<MapView>): void {
  const next = { ...readMapView(), ...patch };
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Kartenausschnitt konnte nicht gespeichert werden:', err);
  }
}
