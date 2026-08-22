import { describe, expect, it } from 'vitest';
import { QUICK_LOG_ICONS } from './quickLogIcons';
import {
  DEFAULT_QUICK_LOG_ICON,
  ICON_VIEWBOX,
  QUICK_LOG_ICON_SHAPES,
  iconShapesForEvent
} from './quickLogIconShapes';
import { QuickLogConfig, QuickLogIconName } from '../types';

const QUICK_LOGS: QuickLogConfig[] = [
  { id: 'schleuse', label: 'Schleuse', iconName: 'anchor' },
  { id: 'pause', label: 'Pause', iconName: 'coffee' }
];

describe('QUICK_LOG_ICON_SHAPES', () => {
  it('kennt jedes Icon, das die Oberfläche anbietet', () => {
    // Sonst zeigte das Tagesbild bei einer neu hinzugefügten Kategorie
    // klaglos das Ersatz-Icon, während im Cockpit das richtige steht.
    expect(Object.keys(QUICK_LOG_ICON_SHAPES).sort()).toEqual(Object.keys(QUICK_LOG_ICONS).sort());
  });

  it('beschreibt jedes Icon mit mindestens einer Form im lucide-Raster', () => {
    for (const [name, shapes] of Object.entries(QUICK_LOG_ICON_SHAPES)) {
      expect(shapes.length, name).toBeGreaterThan(0);
      for (const shape of shapes) {
        if (shape.kind === 'path') expect(shape.d, name).not.toBe('');
        if (shape.kind === 'circle') {
          expect(shape.r, name).toBeGreaterThan(0);
          expect(shape.cx, name).toBeLessThanOrEqual(ICON_VIEWBOX);
          expect(shape.cy, name).toBeLessThanOrEqual(ICON_VIEWBOX);
        }
        if (shape.kind === 'polyline') expect(shape.points.length, name).toBeGreaterThan(1);
      }
    }
  });
});

describe('iconShapesForEvent', () => {
  it('nimmt das Icon der passenden Schnell-Log-Kategorie', () => {
    expect(iconShapesForEvent('pause', QUICK_LOGS)).toBe(QUICK_LOG_ICON_SHAPES.coffee);
  });

  it('fällt bei gelöschter oder unbekannter Kategorie auf das Standard-Icon zurück', () => {
    const fallback = QUICK_LOG_ICON_SHAPES[DEFAULT_QUICK_LOG_ICON as QuickLogIconName];
    expect(iconShapesForEvent('gibtsnichtmehr', QUICK_LOGS)).toBe(fallback);
    expect(iconShapesForEvent('pause', [])).toBe(fallback);
  });
});
