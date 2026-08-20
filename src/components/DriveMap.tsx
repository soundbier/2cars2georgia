/**
 * Karte für den Fahrmodus im Cockpit.
 *
 * Bewusst die abgespeckte Schwester der Kartenseite: dieselben Kachelebenen
 * und derselbe Positionsmarker (components/LiveMap), aber ohne Bedienknöpfe,
 * Log-Marker und Offline-Raster. Im Fahrmodus wird nicht gearbeitet, sondern
 * geschaut – die Karte folgt der eigenen Position, sonst passiert nichts.
 *
 * Der Ausschnitt wird hier nicht gespeichert: Was im Fahrmodus zu sehen ist,
 * ergibt sich aus der eigenen Position, und die Kartenseite soll ihren
 * zuletzt betrachteten Ausschnitt behalten (siehe lib/mapView).
 *
 * Eine Ausnahme von „nur die eigene Position“ ist die auf diesem Gerät
 * aktivierte Route: Wer am Steuer sitzt, will sehen, wo es entlanggeht –
 * dieselbe Linie wie auf der Kartenseite, ohne Wegpunkte zum Anfassen.
 */
import { useState } from 'react';
import { MapContainer } from 'react-leaflet';
import { FollowController, MapTiles, PositionMarker } from './LiveMap';
import { PlannedRouteLine } from './RoutePlanner';
import { useActivePlannedRoute } from '../hooks/usePlannedRoutes';
import { readMapView } from '../lib/mapView';
import { LivePosition } from '../types';

/**
 * Zoomstufe beim Öffnen des Fahrmodus. Bewusst näher dran als die Kartenseite:
 * unterwegs zählt die nächste Abzweigung, nicht die halbe Etappe. Wer mehr
 * Umgebung sehen will, zoomt mit den Fingern heraus.
 */
const DRIVE_ZOOM = 16;

export function DriveMap({ position, user }: { position: LivePosition | null; user: string }) {
  // MapContainer wertet center/zoom nur beim Einhängen aus. Ohne GPS-Fix
  // startet die Karte dort, wo zuletzt geschaut wurde, statt im Nullmeridian.
  const [initialView] = useState(readMapView);
  // Dieselbe Route wie auf der Kartenseite: aktiviert wird sie im Routenplaner,
  // der Fahrmodus zeigt sie nur an.
  const plannedRoute = useActivePlannedRoute();

  return (
    <MapContainer
      center={[position?.lat ?? initialView.lat, position?.lng ?? initialView.lng]}
      zoom={DRIVE_ZOOM}
      className="map-canvas"
      // Gezoomt wird mit den Fingern; die kleinen +/−-Knöpfe wären unterwegs
      // ohnehin nicht zu treffen und nähmen der Karte nur Fläche weg.
      zoomControl={false}
    >
      <MapTiles />
      <PlannedRouteLine waypoints={plannedRoute?.waypoints ?? []} />
      <FollowController position={position} active />
      {position && <PositionMarker position={position} user={user} />}
    </MapContainer>
  );
}
