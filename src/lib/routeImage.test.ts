import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawRouteImage } from './routeImage';
import { QUICK_LOG_ICON_SHAPES } from './quickLogIconShapes';
import { GpsPoint, LogEvent, QuickLogConfig } from '../types';

/**
 * jsdom bringt kein Canvas mit – `getContext('2d')` liefert dort null. Statt
 * das schwergewichtige `canvas`-Paket einzuziehen, protokolliert dieser
 * Ersatz nur, was gezeichnet wurde. Für die Fragen, die hier zählen (sitzt
 * das Icon an der richtigen Stelle, wird überhaupt eins gezeichnet), reicht
 * das aus; wie das Ergebnis aussieht, entscheidet ohnehin das Auge.
 */
interface Recorded {
  moveTo: [number, number][];
  translate: [number, number][];
  strokedPaths: string[];
  arcRadii: number[];
}

function recordingCanvas() {
  const recorded: Recorded = { moveTo: [], translate: [], strokedPaths: [], arcRadii: [] };
  const ctx = {
    canvas: null as unknown,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    measureText: () => ({ width: 100 }),
    fillRect: () => undefined,
    fillText: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: (x: number, y: number) => void recorded.moveTo.push([x, y]),
    lineTo: () => undefined,
    arc: (_x: number, _y: number, r: number) => void recorded.arcRadii.push(r),
    arcTo: () => undefined,
    ellipse: () => undefined,
    fill: () => undefined,
    stroke: (path?: { d: string }) => void (path && recorded.strokedPaths.push(path.d)),
    save: () => undefined,
    restore: () => undefined,
    translate: (x: number, y: number) => void recorded.translate.push([x, y]),
    scale: () => undefined
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, recorded };
}

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

function track(): GpsPoint[] {
  return [
    { ...PASSAU, timestamp: 1_770_000_000_000, author: 'Skipper', speedKmh: 10, headingDeg: 90 },
    { ...LINZ, timestamp: 1_770_003_600_000, author: 'Skipper', speedKmh: 12, headingDeg: 90 }
  ];
}

function event(overrides: Partial<LogEvent>): LogEvent {
  return {
    ...PASSAU,
    timestamp: 1_770_000_000_000,
    author: 'Skipper',
    type: 'pause',
    title: 'Kaffee',
    ...overrides
  };
}

const QUICK_LOGS: QuickLogConfig[] = [{ id: 'pause', label: 'Pause', iconName: 'coffee' }];

/**
 * Mittelpunkte der gezeichneten Icons.
 *
 * Jedes Icon verschiebt zweimal: erst auf seinen Platz im Bild, dann um das
 * halbe lucide-Raster zurück, damit das Symbol mittig sitzt.
 */
function iconCenters(recorded: Recorded): [number, number][] {
  return recorded.translate.filter((_, i) => i % 2 === 0);
}

function draw(events: LogEvent[], points = track()) {
  const { canvas, recorded } = recordingCanvas();
  drawRouteImage(canvas, {
    tripName: 'Sommertour',
    dateLabel: '4. Mai',
    distanceLabel: '120,0 km',
    durationLabel: '3h 0m',
    track: points,
    events,
    quickLogs: QUICK_LOGS,
    backgroundStyle: 'reduced'
  });
  return recorded;
}

beforeEach(() => {
  // Path2D gibt es in jsdom nicht; hier zählt nur, welche Pfaddaten ankommen.
  vi.stubGlobal(
    'Path2D',
    class {
      d: string;
      constructor(d: string) {
        this.d = d;
      }
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('drawRouteImage', () => {
  it('zeichnet zu jedem Ereignis das Icon seiner Kategorie', () => {
    const recorded = draw([event({}), event({ ...LINZ, title: 'Ankunft' })]);

    for (const shape of QUICK_LOG_ICON_SHAPES.coffee) {
      if (shape.kind !== 'path') continue;
      expect(recorded.strokedPaths.filter((d) => d === shape.d)).toHaveLength(2);
    }
  });

  it('setzt das Symbol auf eine Scheibe, die größer ist als die Streckenpunkte', () => {
    // Ohne die Scheibe ging das Strichsymbol auf der gemusterten Fläche unter.
    // Start- und Zielpunkt der Route sind 9 bzw. 12 groß – der Marker deutlich
    // darüber, sonst wäre er wieder nur ein Punkt.
    const recorded = draw([event({})]);

    expect(recorded.arcRadii.filter((r) => r > 20).length).toBeGreaterThanOrEqual(1);
  });

  it('setzt das Icon genau dort ab, wo die Route den Punkt hat', () => {
    // Der eigentliche Zweck des gemeinsamen Ausschnitts: Zuvor bekamen
    // Ereignisse ihre eigene Skalierung und landeten neben der Strecke.
    const recorded = draw([event({})]);

    // Das Ereignis liegt auf dem ersten Trackpunkt – also muss die Route dort
    // ebenfalls ansetzen.
    expect(recorded.moveTo).toContainEqual(iconCenters(recorded)[0]);
  });

  it('zeichnet Ereignisse auch an einem Tag ohne Strecke', () => {
    const recorded = draw([event({})], []);

    expect(iconCenters(recorded)).toHaveLength(1);
  });

  it('greift bei unbekannter Kategorie auf das Standard-Icon zurück', () => {
    const recorded = draw([event({ type: 'gibtsnichtmehr' })]);

    const tagPath = QUICK_LOG_ICON_SHAPES.tag.find((s) => s.kind === 'path');
    expect(tagPath?.kind).toBe('path');
    expect(recorded.strokedPaths).toContain(tagPath && 'd' in tagPath ? tagPath.d : '');
  });
});
