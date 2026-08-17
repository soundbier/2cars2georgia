import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Pencil } from 'lucide-react';
import { db } from './firebase';
import { GpsPoint, LogEvent, USER_COLORS, DEFAULT_USER_COLOR, LogType } from './types';
import { useTracking } from './useTracking';
import { useQuickLogs } from './useQuickLogs';
import { Button, Input, Select, useToast, ConfirmDialog } from './components/ui';
import L from 'leaflet';
import './MapTab.css';

function createUserIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function MapViewController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1], map]);
  return null;
}

interface Props {
  user: string;
  isTracking: boolean;
}

export default function MapTab({ user, isTracking }: Props) {
  const { currentPosition } = useTracking(user, isTracking);
  const { quickLogs } = useQuickLogs();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const { notify } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<LogType>('schleuse');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'track'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts: [number, number][] = [];
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
      notify('Ungültige Koordinaten.', 'danger');
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

  const handleDeleteEvent = async () => {
    if (!deleteTargetId) return;
    await deleteDoc(doc(db, 'events', deleteTargetId));
    setEditingId(null);
    setDeleteTargetId(null);
  };

  const center: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : points.length > 0
      ? points[points.length - 1]
      : [53.5511, 9.9937];

  return (
    <div className="map-view">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <MapViewController center={center} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" />

        {points.length > 1 && <Polyline positions={points} color="#0284c7" weight={4} />}

        {currentPosition && (
          <Marker position={[currentPosition.lat, currentPosition.lng]} icon={createUserIcon(USER_COLORS[user] || DEFAULT_USER_COLOR)}>
            <Popup>
              <div className="map-popup">
                <strong>Aktuelle Position ({user})</strong>
                <div className="helper-text">{currentPosition.speedKmh} km/h</div>
              </div>
            </Popup>
          </Marker>
        )}

        {events.map((evt) => {
          const color = USER_COLORS[evt.author] || DEFAULT_USER_COLOR;
          const isEditing = editingId === evt.id;

          return (
            <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={createUserIcon(color)}>
              <Popup minWidth={200}>
                {!isEditing ? (
                  <div className="map-popup">
                    <strong>{evt.title}</strong>
                    <div className="helper-text">
                      {evt.author} · {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="helper-text">
                      {evt.lat.toFixed(4)}, {evt.lng.toFixed(4)}
                    </div>
                    <Button variant="secondary" fullWidth onClick={() => startEditing(evt)}>
                      <Pencil size={14} /> Bearbeiten
                    </Button>
                  </div>
                ) : (
                  <div className="map-popup stack">
                    <span className="label">Ereignis bearbeiten</span>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Titel" />
                    <Select value={editType} onChange={(e) => setEditType(e.target.value as LogType)}>
                      {quickLogs.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                      {/* Legacy-/gelöschte Kategorie: aktuellen Wert trotzdem anzeigen */}
                      {!quickLogs.some((q) => q.id === editType) && (
                        <option value={editType}>{editType}</option>
                      )}
                    </Select>
                    <div className="row">
                      <Input value={editLat} onChange={(e) => setEditLat(e.target.value)} placeholder="Breitengrad" />
                      <Input value={editLng} onChange={(e) => setEditLng(e.target.value)} placeholder="Längengrad" />
                    </div>
                    <div className="row">
                      <Button fullWidth onClick={() => handleSaveEdit(evt.id!)}>
                        Speichern
                      </Button>
                      <Button variant="destructive" fullWidth onClick={() => setDeleteTargetId(evt.id!)}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Ereignis löschen"
        description="Dieser Log-Eintrag wird endgültig entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
