import { describe, expect, it } from 'vitest';
import {
  buildRouteGrid,
  densifyRoute,
  distanceToBoundsMeters,
  estimateTileCountPerCell,
  GRID_ZOOM,
  MAX_DOWNLOAD_ZOOM,
  MIN_DOWNLOAD_ZOOM,
  pointToTile,
  tileBounds,
  tileKey,
  tilesForCell,
  tilesForCells
} from './tileGrid';
import { Coordinates } from '../types';

/** Ein Stück Donau: Passau – Linz – Wien – Bratislava. */
const DANUBE: Coordinates[] = [
  { lat: 48.5667, lng: 13.4319 },
  { lat: 48.3069, lng: 14.2858 },
  { lat: 48.2082, lng: 16.3738 },
  { lat: 48.1486, lng: 17.1077 }
];

describe('pointToTile / tileBounds', () => {
  it('bildet einen Punkt auf die Kachel ab, die ihn enthält', () => {
    const tile = pointToTile({ lat: 48.2082, lng: 16.3738 }, GRID_ZOOM);
    const bounds = tileBounds(tile);
    expect(bounds.south).toBeLessThanOrEqual(48.2082);
    expect(bounds.north).toBeGreaterThanOrEqual(48.2082);
    expect(bounds.west).toBeLessThanOrEqual(16.3738);
    expect(bounds.east).toBeGreaterThanOrEqual(16.3738);
  });
});

describe('densifyRoute', () => {
  it('füllt große Lücken zwischen zwei Trackpunkten auf', () => {
    const samples = densifyRoute([DANUBE[0], DANUBE[3]], 2_000);
    expect(samples.length).toBeGreaterThan(100);
    expect(samples[0]).toEqual(DANUBE[0]);
    expect(samples[samples.length - 1].lng).toBeCloseTo(DANUBE[3].lng, 6);
  });

  it('liefert für eine leere Route nichts', () => {
    expect(densifyRoute([], 2_000)).toEqual([]);
  });
});

describe('buildRouteGrid', () => {
  it('erzeugt ohne Route kein Raster', () => {
    expect(buildRouteGrid([])).toEqual([]);
  });

  it('deckt jeden Punkt der Route mit einem Rasterfeld ab', () => {
    const cells = buildRouteGrid(DANUBE);
    const keys = new Set(cells.map((cell) => cell.key));

    for (const point of DANUBE) {
      expect(keys.has(tileKey(pointToTile(point, GRID_ZOOM)))).toBe(true);
    }
  });

  it('bildet einen Korridor statt eines Rechtecks über die ganze Route', () => {
    const cells = buildRouteGrid(DANUBE, { corridorMeters: 12_000 });
    const samples = densifyRoute(DANUBE, 2_000);

    // Kein Feld liegt weiter als der Korridor (plus eine Feldkante, weil das
    // Feld als Ganzes hineinragen darf) von der Route entfernt.
    for (const cell of cells) {
      const nearest = Math.min(...samples.map((s) => distanceToBoundsMeters(s, cell.bounds)));
      expect(nearest).toBeLessThanOrEqual(12_000);
    }

    // Das umschließende Rechteck der Route wäre deutlich größer als der
    // Korridor – hier ein Punkt weit nördlich der Strecke.
    const north = { lat: 49.6, lng: 15.0 };
    const northKey = tileKey(pointToTile(north, GRID_ZOOM));
    expect(cells.some((cell) => cell.key === northKey)).toBe(false);
  });

  it('wächst mit der Korridorbreite', () => {
    const narrow = buildRouteGrid(DANUBE, { corridorMeters: 2_000 });
    const wide = buildRouteGrid(DANUBE, { corridorMeters: 40_000 });
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it('bleibt für eine lange Route in einer herunterladbaren Größenordnung', () => {
    const cells = buildRouteGrid(DANUBE);
    // ~450 km Strecke: ein Band aus wenigen Dutzend Feldern, kein Flächenraster.
    expect(cells.length).toBeGreaterThan(5);
    expect(cells.length).toBeLessThan(120);
  });

  it('begrenzt die Feldzahl nach oben', () => {
    const cells = buildRouteGrid(DANUBE, { corridorMeters: 100_000, maxCells: 10 });
    expect(cells.length).toBeLessThanOrEqual(10);
  });
});

describe('tilesForCell', () => {
  it('liefert je eine Übersichtskachel oberhalb und die volle Unterteilung darunter', () => {
    const cell = pointToTile({ lat: 48.2082, lng: 16.3738 }, GRID_ZOOM);
    const tiles = tilesForCell(cell);

    for (let z = MIN_DOWNLOAD_ZOOM; z <= MAX_DOWNLOAD_ZOOM; z++) {
      const expected = z <= GRID_ZOOM ? 1 : 4 ** (z - GRID_ZOOM);
      expect(tiles.filter((tile) => tile.z === z)).toHaveLength(expected);
    }
    expect(tiles).toHaveLength(estimateTileCountPerCell());
  });

  it('bleibt pro Feld unter einer Zahl, die sich unterwegs laden lässt', () => {
    expect(estimateTileCountPerCell()).toBeLessThan(400);
  });

  it('zählt gemeinsame Übersichtskacheln zweier Nachbarfelder nur einmal', () => {
    const a = pointToTile(DANUBE[0], GRID_ZOOM);
    const b = { z: GRID_ZOOM, x: a.x + 1, y: a.y };
    const tiles = tilesForCells([a, b]);
    expect(tiles.length).toBeLessThan(tilesForCell(a).length * 2);
    expect(new Set(tiles.map(tileKey)).size).toBe(tiles.length);
  });
});
