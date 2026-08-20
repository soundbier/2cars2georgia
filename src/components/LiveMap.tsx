/**
 * Bausteine der Live-Karte, die sich Kartenseite und Cockpit teilen.
 *
 * Herausgezogen aus pages/MapTab, damit der Fahrmodus im Cockpit dieselben
 * Marker, dasselbe Folgen und dieselben Kachelebenen benutzt, statt eine
 * zweite Karte danebenzustellen, die sich anders verhält.
 */
import { useEffect, useMemo, useRef, ReactNode } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
// Seiteneffekt-Import: erweitert Leaflet um die Kartendrehung (map.setBearing)
// und die Marker-Option `rotation`.
import 'leaflet-rotate';
import { usePreferences } from '../hooks/usePreferences';
import { getBaseLayer, OVERLAYS, OVERLAY_IDS } from '../lib/mapLayers';
import { getUserColor } from '../lib/userColors';
import { OfflineTileLayer } from './OfflineTileLayer';
import { LivePosition } from '../types';
import 'leaflet/dist/leaflet.css';

const DEG_TO_RAD = Math.PI / 180;

// Leaflet-Icons sind pro Farbe identisch – einmal erzeugen statt bei jedem Render.
const iconCache = new Map<string, L.DivIcon>();

function cachedIcon(key: string, create: () => L.DivIcon): L.DivIcon {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = create();
    iconCache.set(key, icon);
  }
  return icon;
}

/** Punktmarker für Log-Ereignisse und für Positionen ohne bekannten Kurs. */
export function dotIcon(color: string): L.DivIcon {
  return cachedIcon(`dot:${color}`, () =>
    L.divIcon({
      className: 'custom-marker',
      html: `<div class="map-marker-dot" style="background-color: ${color};"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  );
}

/**
 * Bootsrumpf von oben, Bug nach oben.
 *
 * Die Drehung übernimmt leaflet-rotate über die Marker-Option `rotation`, damit
 * sie beim Drehen der Karte ohne Neuaufbau des Icons mitläuft.
 */
export function boatIcon(color: string): L.DivIcon {
  return cachedIcon(`boat:${color}`, () =>
    L.divIcon({
      className: 'custom-marker',
      // Rumpf von oben: spitzer Bug, gerade Bordwände, runder Spiegel.
      html: `<svg class="map-marker-boat" viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
               <path d="M12 2 L16.5 11 L16.5 16.5 A4.5 4.5 0 0 1 7.5 16.5 L7.5 11 Z"
                     fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" />
               <path d="M9.6 12.5 H14.4" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"
                     opacity="0.9" />
             </svg>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    })
  );
}

/** Zieht die Karte der eigenen Position hinterher, solange „Folgen“ aktiv ist. */
export function FollowController({
  position,
  active
}: {
  position: LivePosition | null;
  active: boolean;
}) {
  const map = useMap();
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (!active || lat === undefined || lng === undefined) return;
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [map, active, lat, lng]);

  return null;
}

export function PositionMarker({
  position,
  user,
  children
}: {
  position: LivePosition;
  user: string;
  children?: ReactNode;
}) {
  const markerRef = useRef<L.Marker>(null);
  const color = getUserColor(user);
  const heading = position.headingDeg;
  // Nur der Wechsel zwischen „Kurs bekannt“ und „unbekannt“ tauscht das Icon;
  // der Kurs selbst dreht den vorhandenen Marker, statt ihn neu zu zeichnen.
  const hasHeading = heading !== null;
  const icon = useMemo(
    () => (hasHeading ? boatIcon(color) : dotIcon(color)),
    [hasHeading, color]
  );

  useEffect(() => {
    markerRef.current?.setRotation((heading ?? 0) * DEG_TO_RAD);
  }, [heading, icon]);

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={icon}
      rotation={(heading ?? 0) * DEG_TO_RAD}
      // Kurs über Grund bleibt beim Drehen der Karte geografisch korrekt.
      rotateWithView
      zIndexOffset={1000}
    >
      {children}
    </Marker>
  );
}

/**
 * Grundkarte plus eingeschaltete Overlays, so wie sie in den Einstellungen
 * gewählt wurden – identisch auf Kartenseite und im Fahrmodus.
 */
export function MapTiles() {
  const { preferences } = usePreferences();
  const baseLayer = getBaseLayer(preferences.baseLayer);

  return (
    <>
      <OfflineTileLayer
        // Attribution und Zoomgrenzen gelten pro Quelle: neu einhängen statt
        // nur die URL auszutauschen.
        key={preferences.baseLayer}
        url={baseLayer.url}
        attribution={baseLayer.attribution}
        maxZoom={baseLayer.maxZoom}
        maxNativeZoom={baseLayer.maxNativeZoom}
      />
      {OVERLAY_IDS.filter((id) => preferences.overlays[id]).map((id) => (
        <OfflineTileLayer
          key={id}
          url={OVERLAYS[id].url}
          attribution={OVERLAYS[id].attribution}
          maxZoom={OVERLAYS[id].maxZoom}
          maxNativeZoom={OVERLAYS[id].maxNativeZoom}
        />
      ))}
    </>
  );
}
