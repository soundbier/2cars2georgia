/**
 * Karten- und Overlay-Ebenen.
 *
 * Bewusst nur Dienste ohne API-Schlüssel und ohne Registrierung: Die App soll
 * auf jedem Gerät der Crew sofort funktionieren, auch wenn unterwegs niemand
 * einen Account anlegen kann. Jede Quelle bringt ihre eigene Attribution mit,
 * die Leaflet unten rechts einblendet.
 *
 * Beschriftungen stehen hier bewusst nicht mehr drin, sondern unter den
 * Schlüsseln `layer.{id}` und `layer.{id}.description` in src/i18n – diese
 * Datei beschreibt die technischen Quellen, nicht ihre Darstellung.
 */

export interface TileLayerSpec {
  url: string;
  attribution: string;
  /** Bis hierhin darf gezoomt werden. */
  maxZoom: number;
  /** Ab hier werden Kacheln hochskaliert statt neu geladen (Dienst liefert nicht tiefer). */
  maxNativeZoom?: number;
}

export const BASE_LAYERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 19,
    maxNativeZoom: 17
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    maxZoom: 20
  }
} as const satisfies Record<string, TileLayerSpec>;

export type BaseLayerId = keyof typeof BASE_LAYERS;

export const OVERLAYS = {
  seamarks: {
    url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    attribution: '&copy; OpenSeaMap contributors',
    maxZoom: 19,
    maxNativeZoom: 18
  },
  cycling: {
    url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
    attribution: '&copy; waymarkedtrails.org (CC-BY-SA)',
    maxZoom: 19,
    maxNativeZoom: 18
  },
  hiking: {
    url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
    attribution: '&copy; waymarkedtrails.org (CC-BY-SA)',
    maxZoom: 19,
    maxNativeZoom: 18
  }
} as const satisfies Record<string, TileLayerSpec>;

export type OverlayId = keyof typeof OVERLAYS;

export const BASE_LAYER_IDS = Object.keys(BASE_LAYERS) as BaseLayerId[];
export const OVERLAY_IDS = Object.keys(OVERLAYS) as OverlayId[];

/** Fällt auf die Standardkarte zurück, falls ein alter Wert gespeichert war. */
export function getBaseLayer(id: BaseLayerId): TileLayerSpec {
  return BASE_LAYERS[id] ?? BASE_LAYERS.osm;
}
