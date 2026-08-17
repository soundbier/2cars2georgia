import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { GpsPoint, LogEvent, USER_COLORS, DEFAULT_USER_COLOR, LogType } from './types';
import { useTracking } from './useTracking';
import L from 'leaflet';

// Funktion für dynamisch eingefärbte Marker-Icons
function createUserIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

interface Props {
  user: string;
  isTracking: boolean;
}

export default function MapTab({ user, isTracking }: Props) {
  const { currentPosition } = useTracking(user, isTracking);
  const [points, setPoints] = useState<[number, number][]>([cite: 15]);
  const [events, setEvents] = useState<LogEvent[]>([]);

  // Bearbeitungs-State für das aktive Popup
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<LogType>('schleuse');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'track'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts: [number, number][] =[cite: 15];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as GpsPoint;
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
      snapshot.forEach((docSnap) => {
        evts.push({ id: docSnap.id, ...docSnap.data() } as LogEvent);
      });
      setEvents(evts);
    });
    return () => unsubscribe();
  }, []);

  const startEditing = (evt: LogEvent) => {
    setEditingId(evt.id || null);
    setEditTitle(evt.title);
    setEditType(evt.type);
    setEditLat(evt.lat.toString());
    setEditLng(evt.lng.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const latNum = parseFloat(editLat.replace(',', '.'));
    const lngNum = parseFloat(editLng.replace(',', '.'));
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('Ungültige Koordinaten!');
      return;
    }

    const docRef = doc(db, 'events', id);
    await updateDoc(docRef, {
      title: editTitle,
      type: editType,
      lat: latNum,
      lng: lngNum
    });
    setEditingId(null);
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('Ereignis wirklich löschen?')) {
      await deleteDoc(doc(db, 'events', id));
      setEditingId(null);
    }
  };

  const center: [number, number] = currentPosition 
    ? [currentPosition.lat, currentPosition.lng] 
    : points.length > 0 
      ? points[points.length - 1] 
      : [53.5511, 9.9937];

  const inputStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #3a3a3c',
    background: '#000',
    color: '#fff',
    fontSize: '0.9rem',
    marginBottom: '6px',
    outline: 'none'
  };

  return (
    <div style={{ height: 'calc(100svh - 97px)', margin: '-20px' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />
        
        {points.length > 1 && <Polyline positions={points} color="#f59e0b" weight={4} />}
        
        {currentPosition && (
          <Marker position={[currentPosition.lat, currentPosition.lng]} icon={createUserIcon(USER_COLORS[user] || DEFAULT_USER_COLOR)}>
            <Popup>
              <strong>Aktuelle Position ({user})</strong><br />
              {currentPosition.speedKmh} km/h
            </Popup>
          </Marker>
        )}

        {events.map((evt) => {
          const color = USER_COLORS[evt.author] || DEFAULT_USER_COLOR;
          const isEditing = editingId === evt.id;

          return (
            <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={createUserIcon(color)}>
              <Popup>
                {!isEditing ? (
                  <div style={{ minWidth: '160px' }}>
                    <strong style={{ fontSize: '1rem' }}>{evt.title}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0' }}>
                      Autor: {evt.author} ({new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>
                      Lat: {evt.lat.toFixed(4)}, Lng: {evt.lng.toFixed(4)}
                    </div>
                    <button 
                      onClick={() => startEditing(evt)}
                      style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}
                    >
                      Bearbeiten
                    </button>
                  </div>
                ) : (
                  <div style={{ minWidth: '180px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Ereignis bearbeiten</div>
                    <input 
                      style={inputStyle}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Titel"
                    />
                    <select 
                      style={inputStyle}
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as LogType)}
                    >
                      <option value="schleuse">Schleuse</option>
                      <option value="pause">Pause</option>
                      <option value="panne">Panne</option>
                      <option value="grenze">Grenze</option>
                      <option value="anlegen">Anlegen</option>
                      <option value="tanken">Tanken</option>
                      <option value="pegel">Pegel</option>
                    </select>
                    <input 
                      style={inputStyle}
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      placeholder="Breitengrad (Lat)"
                    />
                    <input 
                      style={inputStyle}
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      placeholder="Längengrad (Lng)"
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => handleSaveEdit(evt.id!)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}
                      >
                        Speichern
                      </button>
                      <button 
                        onClick={() => handleDeleteEvent(evt.id!)}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
