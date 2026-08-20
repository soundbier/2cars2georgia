/**
 * Karten-Bausteine des Routenplaners.
 *
 * Hier steht nur, was mit der Leaflet-Karte zu tun hat: `PlannedRouteLine`
 * zeichnet eine geplante Route (auch auf dem Kartentab, damit man sieht,
 * wofür das Downloadraster gilt), `RouteEditorLayer` nimmt zusätzlich Klicks
 * entgegen und zeigt die verschiebbaren Wegpunkte. Die Seite mit der
 * Routenverwaltung liegt unter pages/RoutePlanner.tsx, die Daten kommen aus
 * hooks/usePlannedRoutes.ts.
 */

import { useCallback, useMemo } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useT } from '../i18n';
import { createWaypoint, plannedRouteLengthMeters, PlannedWaypoint } from '../lib/plannedRoute';
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

export interface RouteEditorState {
  waypoints: PlannedWaypoint[];
  addAt: (lat: number, lng: number) => void;
  moveTo: (id: string, lat: number, lng: number) => void;
  remove: (id: string) => void;
  undo: () => void;
  clear: () => void;
  lengthMeters: number;
}

/**
 * Bearbeitet die Wegpunkte einer Route.
 *
 * Hält bewusst keinen eigenen Zustand: Jede Änderung geht sofort über
 * `onChange` in den Speicher (Firestore, siehe hooks/usePlannedRoutes.ts).
 * Auf dem Wasser gibt es kein „Speichern nicht vergessen“, und der Stand
 * muss auch nach einem Neuladen ohne Netz noch da sein – dafür sorgt der
 * lokale Firestore-Cache.
 */
export function useRouteEditor(
  waypoints: PlannedWaypoint[],
  onChange: (next: PlannedWaypoint[]) => void
): RouteEditorState {
  return {
    waypoints,
    addAt: useCallback(
      (lat: number, lng: number) => onChange([...waypoints, createWaypoint(lat, lng)]),
      [onChange, waypoints]
    ),
    moveTo: useCallback(
      (id: string, lat: number, lng: number) =>
        onChange(waypoints.map((point) => (point.id === id ? { ...point, lat, lng } : point))),
      [onChange, waypoints]
    ),
    remove: useCallback(
      (id: string) => onChange(waypoints.filter((point) => point.id !== id)),
      [onChange, waypoints]
    ),
    undo: useCallback(() => onChange(waypoints.slice(0, -1)), [onChange, waypoints]),
    clear: useCallback(() => onChange([]), [onChange]),
    lengthMeters: useMemo(() => plannedRouteLengthMeters(waypoints), [waypoints])
  };
}

/** Nur die Linie einer geplanten Route – ohne Bedienung. */
export function PlannedRouteLine({ waypoints }: { waypoints: PlannedWaypoint[] }) {
  if (waypoints.length < 2) return null;
  const line = waypoints.map((point) => [point.lat, point.lng] as [number, number]);

  return (
    <>
      {/* Heller Rand darunter: sonst verschwindet die Linie auf Satellit und Topo. */}
      <Polyline
        positions={line}
        pathOptions={{ color: PLANNED_CASING_COLOR, weight: 6, opacity: 0.6, lineCap: 'round' }}
      />
      <Polyline
        positions={line}
        pathOptions={{ color: PLANNED_COLOR, weight: 3, dashArray: '8 6', lineCap: 'round' }}
      />
    </>
  );
}

/**
 * Wegpunkte setzen, verschieben und entfernen.
 *
 * Klicks nimmt die Karte nur an, solange `active` gilt – auf der Planerseite
 * heißt das: erst eine Route auswählen, dann abstecken.
 */
export function RouteEditorLayer({
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

  return (
    <>
      <PlannedRouteLine waypoints={waypoints} />

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
            title={t('plan.removePoint')}
            zIndexOffset={900}
          />
        ))}
    </>
  );
}
