import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { GpsPoint, LogEvent } from './types';
import { useTracking } from './useTracking';
import L from 'leaflet';

// Leaflet Default Marker Icon Fix
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface Props {
  user: string;
  isTracking: boolean;
}

export default function MapTab({ user, isTracking }: Props) {
  const { currentPosition } = useTracking(user, isTracking);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'track'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts: [number, number][] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as GpsPoint;
        pts.push([data.lat, data.lng]);
      });
      setPoints(pts);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evts: LogEvent[] = [];
      snapshot.forEach((doc) => {
        evts.push({ id: doc.id, ...doc.data() } as LogEvent);
      });
      setEvents(evts);
    });
    return () => unsubscribe();
  }, []);

  const center: [number, number] = currentPosition 
    ? [currentPosition.lat, currentPosition.lng] 
    : points.length > 0 
      ? points[points.length - 1] 
      : [53.5511, 9.9937];

  return (
    <div style={{ height: 'calc(100vh - 97px)', margin: '-16px' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />
        
        {points.length > 1 && <Polyline positions={points} color="#0284c7" weight={4} />}
        
        {currentPosition && (
          <Marker position={[currentPosition.lat, currentPosition.lng]} icon={defaultIcon}>
            <Popup>Aktuelle Position ({user})<br />{currentPosition.speedKmh} km/h</Popup>
          </Marker>
        )}

        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={defaultIcon}>
            <Popup>
              <strong>{evt.title}</strong><br />
              {new Date(evt.timestamp).toLocaleTimeString()}<br />
              Log von: {evt.author}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
