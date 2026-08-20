/**
 * Rasterfelder entlang der gefahrenen Route.
 *
 * Für den Offline-Download soll nicht „alles im Bildausschnitt“ geladen
 * werden – auf einer Route wie der Donau wären das zehntausende Kacheln. Statt
 * dessen wird aus der Route ein Korridor gebildet und dieser in Felder
 * zerlegt, die einzeln ausgewählt werden können.
 *
 * Die Felder sind bewusst keine frei erfundenen Rechtecke, sondern exakt die
 * Kacheln einer festen Zoomstufe (GRID_ZOOM): Damit fällt jedes Feld sauber in
 * die Kachelpyramide, und die Kacheln aller tieferen Zoomstufen lassen sich
 * ohne Rundungsfehler daraus ableiten.
 */

import { Coordinates } from '../types';
import { distanceMeters } from './geo';

/**
 * Zoomstufe, deren Kacheln ein Rasterfeld bilden (~13–20 km Kantenlänge).
 *
 * Eine Stufe tiefer als die Rasterzoomstufe halbiert die Kantenlänge eines
 * Feldes: Man wählt genauer aus, was tatsächlich gebraucht wird, und ein
 * einzelnes Feld ist mit ~90 statt ~345 Kacheln je Ebene schnell geladen.
 */
export const GRID_ZOOM = 11;

/** Kleinste heruntergeladene Zoomstufe – grobe Übersicht über die Region. */
export const MIN_DOWNLOAD_ZOOM = 6;

/**
 * Tiefste heruntergeladene Zoomstufe.
 *
 * 14 zeigt Straßen, Uferwege und Ortsnamen – genug zur Orientierung an Bord.
 * Jede weitere Stufe vervierfacht die Kachelzahl (Z15 allein wären 1024
 * Kacheln pro Feld), das ist ohne Netz unterwegs nicht mehr praktikabel.
 */
export const MAX_DOWNLOAD_ZOOM = 14;

/** Breite des Korridors links und rechts der Route. */
export const DEFAULT_CORRIDOR_METERS = 12_000;

/** Abstand, in dem die Route für die Feldsuche abgetastet wird. */
const DEFAULT_SAMPLE_METERS = 2_000;

/**
 * Obergrenze für die Feldzahl.
 *
 * Schützt vor einer versehentlich riesigen Route (oder einem Ausreißer im
 * GPS-Track): Lieber ein abgeschnittenes Raster als eine Karte, die beim
 * Öffnen des Downloadmodus minutenlang rechnet. Mit den kleineren Feldern
 * (GRID_ZOOM 11) deckt dieselbe Strecke rund viermal so viele Felder ab,
 * deshalb liegt die Grenze entsprechend höher.
 */
const MAX_CELLS = 4_000;

/** Mittlere Kachelgröße in Byte – nur zur Abschätzung der Downloadmenge. */
export const AVERAGE_TILE_BYTES = 18_000;

export interface TileCoords {
  z: number;
  x: number;
  y: number;
}

export interface CellBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export interface GridCell extends TileCoords {
  /** Stabile Kennung des Feldes, auch als Schlüssel im gespeicherten Bestand. */
  key: string;
  bounds: CellBounds;
}

const MAX_LATITUDE = 85.0511287798;

function clampLatitude(lat: number): number {
  return Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, lat));
}

/** Kachelspalte (als Fließkommazahl) für einen Längengrad. */
export function tileXFromLng(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 2 ** zoom;
}

/** Kachelzeile (als Fließkommazahl) für einen Breitengrad (Web Mercator). */
export function tileYFromLat(lat: number, zoom: number): number {
  const rad = (clampLatitude(lat) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

export function lngFromTileX(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

export function latFromTileY(y: number, zoom: number): number {
  const n = Math.PI - 2 * Math.PI * (y / 2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Kachel, in der ein Punkt liegt. */
export function pointToTile(point: Coordinates, zoom: number): TileCoords {
  const span = 2 ** zoom;
  const x = Math.min(span - 1, Math.max(0, Math.floor(tileXFromLng(point.lng, zoom))));
  const y = Math.min(span - 1, Math.max(0, Math.floor(tileYFromLat(point.lat, zoom))));
  return { z: zoom, x, y };
}

export function tileBounds({ z, x, y }: TileCoords): CellBounds {
  return {
    north: latFromTileY(y, z),
    south: latFromTileY(y + 1, z),
    west: lngFromTileX(x, z),
    east: lngFromTileX(x + 1, z)
  };
}

export function tileKey({ z, x, y }: TileCoords): string {
  return `${z}/${x}/${y}`;
}

/** Kürzester Abstand eines Punktes zu einem Rechteck, in Metern. */
export function distanceToBoundsMeters(point: Coordinates, bounds: CellBounds): number {
  const lat = Math.min(bounds.north, Math.max(bounds.south, point.lat));
  const lng = Math.min(bounds.east, Math.max(bounds.west, point.lng));
  return distanceMeters(point, { lat, lng });
}

/**
 * Route in gleichmäßige Stützpunkte zerlegen.
 *
 * Ein GPS-Track hat mal Punkte im Sekundentakt, mal eine Lücke von 20 km (kein
 * Empfang, App geschlossen). Ohne das Nachverdichten fielen die Felder in
 * solchen Lücken aus dem Raster.
 */
export function densifyRoute(route: Coordinates[], stepMeters: number): Coordinates[] {
  const points = route.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const samples: Coordinates[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const gap = distanceMeters(from, to);
    const steps = Math.max(1, Math.ceil(gap / stepMeters));
    for (let step = 1; step <= steps; step++) {
      const f = step / steps;
      samples.push({ lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f });
    }
  }
  return samples;
}

export interface RouteGridOptions {
  gridZoom?: number;
  corridorMeters?: number;
  sampleMeters?: number;
  maxCells?: number;
}

/**
 * Rasterfelder im Korridor um die Route.
 *
 * Erst werden die Felder gesammelt, durch die die Route selbst läuft, danach
 * deren Nachbarn – aber nur solange sie noch innerhalb des Korridors liegen.
 * So entsteht ein Band entlang der Route statt eines Rechtecks über dem
 * gesamten Verlauf, das bei der Donau halb Europa umfasst hätte.
 */
export function buildRouteGrid(route: Coordinates[], options: RouteGridOptions = {}): GridCell[] {
  const gridZoom = options.gridZoom ?? GRID_ZOOM;
  const corridorMeters = options.corridorMeters ?? DEFAULT_CORRIDOR_METERS;
  const sampleMeters = options.sampleMeters ?? DEFAULT_SAMPLE_METERS;
  const maxCells = options.maxCells ?? MAX_CELLS;

  const samples = densifyRoute(route, sampleMeters);
  if (samples.length === 0) return [];

  // Stützpunkte nach Feld sortiert: Für die Abstandsprüfung eines Feldes
  // reichen die Punkte der Nachbarfelder, nicht die der gesamten Route.
  const samplesByCell = new Map<string, Coordinates[]>();
  for (const sample of samples) {
    const key = tileKey(pointToTile(sample, gridZoom));
    const bucket = samplesByCell.get(key);
    if (bucket) bucket.push(sample);
    else samplesByCell.set(key, [sample]);
  }

  // Wie viele Nachbarringe der Korridor überhaupt erreichen kann. Die
  // Kachelbreite hängt vom Breitengrad ab, deshalb aus einer echten Kachel
  // der Route abgeleitet statt aus einer Faustformel.
  const referenceBounds = tileBounds(pointToTile(samples[0], gridZoom));
  const cellHeightMeters = distanceMeters(
    { lat: referenceBounds.south, lng: referenceBounds.west },
    { lat: referenceBounds.north, lng: referenceBounds.west }
  );
  const cellWidthMeters = distanceMeters(
    { lat: referenceBounds.south, lng: referenceBounds.west },
    { lat: referenceBounds.south, lng: referenceBounds.east }
  );
  const smallestSide = Math.max(1, Math.min(cellHeightMeters, cellWidthMeters));
  const ring = Math.min(4, 1 + Math.floor(corridorMeters / smallestSide));

  const span = 2 ** gridZoom;
  const cells = new Map<string, GridCell>();

  for (const key of samplesByCell.keys()) {
    const [, xs, ys] = key.split('/');
    const cx = Number(xs);
    const cy = Number(ys);

    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= span || y >= span) continue;

        const coords: TileCoords = { z: gridZoom, x, y };
        const cellId = tileKey(coords);
        if (cells.has(cellId)) continue;

        const bounds = tileBounds(coords);
        if (!isWithinCorridor(bounds, cx, cy, ring, samplesByCell, gridZoom, corridorMeters)) continue;

        cells.set(cellId, { ...coords, key: cellId, bounds });
        if (cells.size >= maxCells) break;
      }
      if (cells.size >= maxCells) break;
    }
    if (cells.size >= maxCells) break;
  }

  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function isWithinCorridor(
  bounds: CellBounds,
  originX: number,
  originY: number,
  ring: number,
  samplesByCell: Map<string, Coordinates[]>,
  gridZoom: number,
  corridorMeters: number
): boolean {
  for (let dx = -ring; dx <= ring; dx++) {
    for (let dy = -ring; dy <= ring; dy++) {
      const bucket = samplesByCell.get(tileKey({ z: gridZoom, x: originX + dx, y: originY + dy }));
      if (!bucket) continue;
      for (const sample of bucket) {
        if (distanceToBoundsMeters(sample, bounds) <= corridorMeters) return true;
      }
    }
  }
  return false;
}

export interface ZoomRange {
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Alle Kacheln eines Rasterfeldes über die Zoomstufen hinweg.
 *
 * Oberhalb der Rasterzoomstufe ist es genau eine Kachel je Stufe (die
 * Übersicht, in der das Feld enthalten ist), darunter die vollständige
 * Unterteilung.
 */
export function tilesForCell(cell: TileCoords, range: ZoomRange = {}): TileCoords[] {
  const minZoom = range.minZoom ?? MIN_DOWNLOAD_ZOOM;
  const maxZoom = range.maxZoom ?? MAX_DOWNLOAD_ZOOM;
  const tiles: TileCoords[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    if (z <= cell.z) {
      const factor = 2 ** (cell.z - z);
      tiles.push({ z, x: Math.floor(cell.x / factor), y: Math.floor(cell.y / factor) });
      continue;
    }
    const factor = 2 ** (z - cell.z);
    const baseX = cell.x * factor;
    const baseY = cell.y * factor;
    for (let x = baseX; x < baseX + factor; x++) {
      for (let y = baseY; y < baseY + factor; y++) tiles.push({ z, x, y });
    }
  }

  return tiles;
}

/** Kacheln mehrerer Felder, ohne Dopplungen der geteilten Übersichtsstufen. */
export function tilesForCells(cells: TileCoords[], range: ZoomRange = {}): TileCoords[] {
  const seen = new Set<string>();
  const tiles: TileCoords[] = [];
  for (const cell of cells) {
    for (const tile of tilesForCell(cell, range)) {
      const key = tileKey(tile);
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Kachelzahl eines einzelnen Rasterfeldes – Grundlage der Mengenabschätzung. */
export function estimateTileCountPerCell(range: ZoomRange = {}): number {
  return tilesForCell({ z: GRID_ZOOM, x: 0, y: 0 }, range).length;
}
