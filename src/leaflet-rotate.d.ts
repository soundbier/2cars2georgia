/**
 * Typen für das leaflet-rotate-Plugin.
 *
 * Das Plugin erweitert Leaflet zur Laufzeit (Import mit Seiteneffekt) und
 * bringt selbst keine Typdefinitionen mit. Hier stehen nur die Teile, die
 * die App tatsächlich verwendet.
 */
import 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    /** Aktiviert die Drehung der Karte. Ohne dies bleiben alle Bearing-APIs wirkungslos. */
    rotate?: boolean;
    /** Startausrichtung in Grad (Drehung des Karteninhalts im Uhrzeigersinn). */
    bearing?: number;
    /** Drehen mit zwei Fingern. */
    touchRotate?: boolean;
    /** Eingebaute Kompassrose des Plugins – wir zeichnen eine eigene. */
    rotateControl?: boolean;
    /** Drehen am Desktop per Shift + Ziehen/Scrollen. */
    shiftKeyRotate?: boolean;
  }

  interface Map {
    setBearing(degrees: number): void;
    getBearing(): number;
  }

  interface MarkerOptions {
    /** Eigendrehung des Icons in Radiant (0 = Icon zeigt nach oben). */
    rotation?: number;
    /** Wenn true, addiert das Plugin die Kartendrehung zur Eigendrehung. */
    rotateWithView?: boolean;
  }

  interface Marker {
    setRotation(radians: number): void;
  }
}

declare module 'leaflet-rotate';
