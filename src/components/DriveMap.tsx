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
 */
import { useState } from 'react';
import { MapContainer } from 'react-leaflet';
import { FollowController, MapTiles, PositionMarker } from './LiveMap';
import { readMapView } from '../lib/mapView';
import { LivePosition } from '../types';

export function DriveMap({ position, user }: { position: LivePosition | null; user: string }) {
  // MapContainer wertet center/zoom nur beim Einhängen aus – die Zoomstufe der
  // Kartenseite ist dabei die beste verfügbare Vermutung, und ohne GPS-Fix
  // startet die Karte dort, wo zuletzt geschaut wurde, statt im Nullmeridian.
  const [initialView] = useState(readMapView);

  return (
    <MapContainer
      center={[position?.lat ?? initialView.lat, position?.lng ?? initialView.lng]}
      zoom={initialView.zoom}
      className="map-canvas"
      // Gezoomt wird mit den Fingern; die kleinen +/−-Knöpfe wären unterwegs
      // ohnehin nicht zu treffen und nähmen der Karte nur Fläche weg.
      zoomControl={false}
    >
      <MapTiles />
      <FollowController position={position} active />
      {position && <PositionMarker position={position} user={user} />}
    </MapContainer>
  );
}
