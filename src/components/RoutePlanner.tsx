/**
 * Karten-Bausteine des Routenplaners.
 *
 * Hier steht nur, was mit der Leaflet-Karte zu tun hat: `PlannedRouteLine`
 * zeichnet eine geplante Route (auch auf dem Kartentab, damit man sieht,
 * wofür das Downloadraster gilt), `RouteEditorLayer` nimmt zusätzlich Klicks
 * entgegen und zeigt die verschiebbaren Wegpunkte. Die Seite mit der
 * Routenverwaltung liegt unter pages/RoutePlanner.tsx, die Daten in
 * lib/plannedRoute.ts.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useT } from '../i18n';
import {
  createWaypoint,
  findRoute,
  PlannedRoute,
  plannedRouteLengthMeters,
  PlannedWaypoint,
  readPlannedRoutes,
  setRouteWaypoints,
  subscribePlannedRoutes
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

/** Aktive Route – die, deren Strecke auf der Karte und im Download gilt. */
export function useActivePlannedRoute(): PlannedRoute | null {
  const store = useSyncExternalStore(subscribePlannedRoutes, readPlannedRoutes);
  return useMemo(() => findRoute(store, store.activeId), [store]);
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
 * Jede Änderung geht direkt in den Speicher: Auf dem Wasser gibt es kein
 * „Speichern nicht vergessen“, und der Stand muss auch nach einem Neuladen
 * ohne Netz noch da sein.
 */
export function useRouteEditor(routeId: string | null): RouteEditorState {
  const store = useSyncExternalStore(subscribePlannedRoutes, readPlannedRoutes);
  const waypoints = useMemo(() => findRoute(store, routeId)?.waypoints ?? [], [store, routeId]);

  const current = useCallback(
    () => (routeId ? (findRoute(readPlannedRoutes(), routeId)?.waypoints ?? []) : []),
    [routeId]
  );

  const write = useCallback(
    (next: PlannedWaypoint[]) => {
      if (routeId) setRouteWaypoints(routeId, next);
    },
    [routeId]
  );

  return {
    waypoints,
    addAt: useCallback(
      (lat: number, lng: number) => write([...current(), createWaypoint(lat, lng)]),
      [current, write]
    ),
    moveTo: useCallback(
      (id: string, lat: number, lng: number) =>
        write(current().map((point) => (point.id === id ? { ...point, lat, lng } : point))),
      [current, write]
    ),
    remove: useCallback(
      (id: string) => write(current().filter((point) => point.id !== id)),
      [current, write]
    ),
    undo: useCallback(() => write(current().slice(0, -1)), [current, write]),
    clear: useCallback(() => write([]), [write]),
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
