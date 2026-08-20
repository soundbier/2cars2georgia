/**
 * Route von Hand abstecken.
 *
 * Wie beim Downloadmodus stehen die drei zusammengehörigen Teile in einer
 * Datei: `useRoutePlanner` hält den Zustand, `RoutePlannerLayer` zeichnet
 * Wegpunkte und Verbindungslinie in die Karte und nimmt Klicks entgegen,
 * `RoutePlannerPanel` ist die Bedienleiste. Aus der abgesteckten Route
 * entsteht anschließend dasselbe Downloadraster wie aus einem Track.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import { DownloadCloud, Trash2, Undo2, X } from 'lucide-react';
import L from 'leaflet';
import { Button } from './ui';
import { useT } from '../i18n';
import { usePreferences } from '../hooks/usePreferences';
import { formatDistance } from '../lib/units';
import {
  createWaypoint,
  plannedRouteLengthMeters,
  PlannedWaypoint,
  readPlannedRoute,
  subscribePlannedRoute,
  writePlannedRoute
} from '../lib/plannedRoute';
import './RoutePlanner.css';

// Wie beim Track (siehe MapTab): Leaflet schreibt die Farbe als SVG-Attribut,
// dort greifen keine CSS-Variablen. Türkis = geplant, Terracotta = gefahren.
const PLANNED_COLOR = '#2a7f87';
const PLANNED_CASING_COLOR = '#ffffff';

const iconCache = new Map<number, L.DivIcon>();

/** Nummerierter Wegpunkt – die Nummer zeigt die Reihenfolge der Route. */
function waypointIcon(index: number): L.DivIcon {
  let icon = iconCache.get(index);
  if (!icon) {
    icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="route-waypoint">${index}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    iconCache.set(index, icon);
  }
  return icon;
}

export interface RoutePlannerState {
  active: boolean;
  open: () => void;
  close: () => void;
  waypoints: PlannedWaypoint[];
  addAt: (lat: number, lng: number) => void;
  moveTo: (id: string, lat: number, lng: number) => void;
  remove: (id: string) => void;
  undo: () => void;
  clear: () => void;
  lengthMeters: number;
}

/** Zustand der Routenplanung. Die Wegpunkte selbst liegen in lib/plannedRoute. */
export function useRoutePlanner(): RoutePlannerState {
  const [active, setActive] = useState(false);
  const waypoints = useSyncExternalStore(subscribePlannedRoute, readPlannedRoute);

  const addAt = useCallback(
    (lat: number, lng: number) => writePlannedRoute([...readPlannedRoute(), createWaypoint(lat, lng)]),
    []
  );

  const moveTo = useCallback((id: string, lat: number, lng: number) => {
    writePlannedRoute(readPlannedRoute().map((point) => (point.id === id ? { ...point, lat, lng } : point)));
  }, []);

  const remove = useCallback((id: string) => {
    writePlannedRoute(readPlannedRoute().filter((point) => point.id !== id));
  }, []);

  const undo = useCallback(() => writePlannedRoute(readPlannedRoute().slice(0, -1)), []);

  const clear = useCallback(() => writePlannedRoute([]), []);

  const lengthMeters = useMemo(() => plannedRouteLengthMeters(waypoints), [waypoints]);

  return {
    active,
    open: useCallback(() => setActive(true), []),
    close: useCallback(() => setActive(false), []),
    waypoints,
    addAt,
    moveTo,
    remove,
    undo,
    clear,
    lengthMeters
  };
}

/**
 * Wegpunkte und Verbindungslinie in der Karte.
 *
 * Die Linie bleibt auch außerhalb des Planungsmodus sichtbar – sonst wüsste
 * man beim Download nicht, wofür das Raster gilt. Klicks nimmt die Karte nur
 * im Planungsmodus entgegen, damit sich sonst niemand versehentlich Punkte
 * setzt.
 */
export function RoutePlannerLayer({
  active,
  waypoints,
  onAdd,
  onMove,
  onRemove
}: {
  active: boolean;
  waypoints: PlannedWaypoint[];
  onAdd: (lat: number, lng: number) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();

  useMapEvents({
    click: (event) => {
      if (active) onAdd(event.latlng.lat, event.latlng.lng);
    }
  });

  const line = waypoints.map((point) => [point.lat, point.lng] as [number, number]);

  return (
    <>
      {line.length > 1 && (
        <>
          <Polyline
            positions={line}
            pathOptions={{ color: PLANNED_CASING_COLOR, weight: 6, opacity: 0.6, lineCap: 'round' }}
          />
          <Polyline
            positions={line}
            pathOptions={{ color: PLANNED_COLOR, weight: 3, dashArray: '8 6', lineCap: 'round' }}
          />
        </>
      )}

      {active &&
        waypoints.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={waypointIcon(index + 1)}
            draggable
            // Tippen entfernt den Punkt wieder: ein Popup mit Löschknopf wäre
            // auf dem Wasser zwei Bedienschritte zu viel.
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as L.Marker).getLatLng();
                onMove(point.id, lat, lng);
              },
              click: () => onRemove(point.id)
            }}
            title={t('map.planRemovePoint')}
            zIndexOffset={900}
          />
        ))}
    </>
  );
}

/** Bedienleiste der Routenplanung. */
export function RoutePlannerPanel({
  state,
  onDownload
}: {
  state: RoutePlannerState;
  onDownload: () => void;
}) {
  const t = useT();
  const { preferences } = usePreferences();
  const count = state.waypoints.length;

  return (
    <div className="offline-panel" role="dialog" aria-label={t('map.planTitle')}>
      <div className="offline-panel-header">
        <strong>{t('map.planTitle')}</strong>
        <button
          type="button"
          className="offline-panel-close"
          onClick={state.close}
          aria-label={t('map.planClose')}
        >
          <X size={18} />
        </button>
      </div>

      <p className="helper-text">{t('map.planIntro')}</p>

      <div className="offline-panel-stats">
        <span>{t('map.planPoints', { count })}</span>
        {count > 1 && (
          <span className="helper-text">
            {formatDistance(state.lengthMeters / 1000, preferences.unitSystem)}
          </span>
        )}
      </div>

      <div className="row">
        <Button variant="secondary" fullWidth onClick={state.undo} disabled={count === 0}>
          <Undo2 size={16} /> {t('map.planUndo')}
        </Button>
        <Button variant="secondary" fullWidth onClick={state.clear} disabled={count === 0}>
          <Trash2 size={16} /> {t('map.planClear')}
        </Button>
      </div>

      <Button fullWidth onClick={onDownload} disabled={count < 2}>
        <DownloadCloud size={16} /> {t('map.planDownload')}
      </Button>
    </div>
  );
}
