import { LogType, QuickLogConfig, QuickLogIconName } from '../types';

/**
 * Dieselben Icons wie in der Oberfläche, aber als reine Geometrie.
 *
 * Auf dem Canvas des Tagesbilds (siehe lib/routeImage.ts) lässt sich eine
 * React-Komponente nicht zeichnen, und lucide-react gibt seine Pfaddaten nicht
 * nach außen – sie stecken in der Closure von `createLucideIcon`. Deshalb
 * liegen die Formen hier ein zweites Mal, wörtlich übernommen aus
 * lucide-react 0.395 (ISC), damit Karte, Cockpit und Tagesbild dasselbe Symbol
 * zeigen.
 *
 * Beim Aktualisieren von lucide-react gehören geänderte Icons hier nach –
 * `quickLogIconShapes.test.ts` stellt nur sicher, dass keins fehlt, nicht dass
 * es noch aktuell ist.
 */

export type IconShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; filled?: true }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polyline'; points: [number, number][] };

/** Kantenlänge des lucide-Rasters – alle Koordinaten unten beziehen sich darauf. */
export const ICON_VIEWBOX = 24;

/** Strichstärke im lucide-Raster, ebenfalls wie in der Oberfläche. */
export const ICON_STROKE_WIDTH = 2;

export const QUICK_LOG_ICON_SHAPES: Record<QuickLogIconName, IconShape[]> = {
  anchor: [
    { kind: 'path', d: 'M12 22V8' },
    { kind: 'path', d: 'M5 12H2a10 10 0 0 0 20 0h-3' },
    { kind: 'circle', cx: 12, cy: 5, r: 3 }
  ],
  coffee: [
    { kind: 'path', d: 'M10 2v2' },
    { kind: 'path', d: 'M14 2v2' },
    {
      kind: 'path',
      d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'
    },
    { kind: 'path', d: 'M6 2v2' }
  ],
  'alert-triangle': [
    { kind: 'path', d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
    { kind: 'path', d: 'M12 9v4' },
    { kind: 'path', d: 'M12 17h.01' }
  ],
  'map-pin': [
    { kind: 'path', d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' },
    { kind: 'circle', cx: 12, cy: 10, r: 3 }
  ],
  home: [
    { kind: 'path', d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    {
      kind: 'polyline',
      points: [
        [9, 22],
        [9, 12],
        [15, 12],
        [15, 22]
      ]
    }
  ],
  fuel: [
    { kind: 'line', x1: 3, y1: 22, x2: 15, y2: 22 },
    { kind: 'line', x1: 4, y1: 9, x2: 14, y2: 9 },
    { kind: 'path', d: 'M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18' },
    { kind: 'path', d: 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5' }
  ],
  gauge: [
    { kind: 'path', d: 'm12 14 4-4' },
    { kind: 'path', d: 'M3.34 19a10 10 0 1 1 17.32 0' }
  ],
  tag: [
    {
      kind: 'path',
      d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z'
    },
    { kind: 'circle', cx: 7.5, cy: 7.5, r: 0.5, filled: true }
  ],
  ship: [
    {
      kind: 'path',
      d: 'M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'
    },
    { kind: 'path', d: 'M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76' },
    { kind: 'path', d: 'M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6' },
    { kind: 'path', d: 'M12 10v4' },
    { kind: 'path', d: 'M12 2v3' }
  ],
  utensils: [
    { kind: 'path', d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' },
    { kind: 'path', d: 'M7 2v20' },
    { kind: 'path', d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' }
  ],
  camera: [
    {
      kind: 'path',
      d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'
    },
    { kind: 'circle', cx: 12, cy: 13, r: 3 }
  ],
  wrench: [
    {
      kind: 'path',
      d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
    }
  ],
  'shopping-cart': [
    { kind: 'circle', cx: 8, cy: 21, r: 1 },
    { kind: 'circle', cx: 19, cy: 21, r: 1 },
    {
      kind: 'path',
      d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'
    }
  ],
  compass: [
    {
      kind: 'path',
      d: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z'
    },
    { kind: 'circle', cx: 12, cy: 12, r: 10 }
  ],
  sun: [
    { kind: 'circle', cx: 12, cy: 12, r: 4 },
    { kind: 'path', d: 'M12 2v2' },
    { kind: 'path', d: 'M12 20v2' },
    { kind: 'path', d: 'm4.93 4.93 1.41 1.41' },
    { kind: 'path', d: 'm17.66 17.66 1.41 1.41' },
    { kind: 'path', d: 'M2 12h2' },
    { kind: 'path', d: 'M20 12h2' },
    { kind: 'path', d: 'm6.34 17.66-1.41 1.41' },
    { kind: 'path', d: 'm19.07 4.93-1.41 1.41' }
  ],
  users: [
    { kind: 'path', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
    { kind: 'circle', cx: 9, cy: 7, r: 4 },
    { kind: 'path', d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    { kind: 'path', d: 'M16 3.13a4 4 0 0 1 0 7.75' }
  ]
};

/** Icon eines Schnell-Logs, das keins (mehr) hat – wie in lib/quickLogIcons.tsx. */
export const DEFAULT_QUICK_LOG_ICON: QuickLogIconName = 'tag';

/**
 * Das Icon zu einem Log-Ereignis.
 *
 * Ereignisse speichern nur ihre Kategorie-Id (siehe LogType in types.ts); das
 * Icon steht in den Schnell-Log-Einstellungen. Eine gelöschte oder von Hand
 * vergebene Kategorie findet dort nichts – dann bleibt es beim Standard-Icon,
 * genauso wie im Logbuch.
 */
export function iconShapesForEvent(type: LogType, quickLogs: QuickLogConfig[]): IconShape[] {
  const iconName = quickLogs.find((log) => log.id === type)?.iconName;
  return QUICK_LOG_ICON_SHAPES[iconName as QuickLogIconName] ?? QUICK_LOG_ICON_SHAPES[DEFAULT_QUICK_LOG_ICON];
}
