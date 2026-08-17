import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Pencil } from 'lucide-react';
import L from 'leaflet';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useTracking } from '../hooks/useTracking';
import { useQuickLogs } from '../hooks/useSettings';
import { getUserColor } from '../lib/userColors';
import { GpsPoint, LogEvent, LogType, QuickLogConfig } from '../types';
import { Button, Input, Select, useToast, ConfirmDialog } from '../components/ui';
import 'leaflet/dist/leaflet.css';
import './MapTab.css';

/** Hamburg als Startansicht, solange weder GPS noch Track vorliegen. */
const FALLBACK_CENTER: [number, number] = [53.5511, 9.9937];

// Leaflet setzt die Linienfarbe als SVG-Attribut – dort werden CSS-Variablen
// nicht aufgelöst, deshalb hier der Literalwert von --color-accent.
const TRACK_COLOR = '#0284c7';

// Leaflet-Icons sind pro Farbe identisch – einmal erzeugen statt bei jedem Render.
const iconCache = new Map<string, L.DivIcon>();

function userIcon(color: string): L.DivIcon {
  let icon = iconCache.get(color);
  if (!icon) {
    icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="map-marker-dot" style="background-color: ${color};"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    iconCache.set(color, icon);
  }
  return icon;
}

function MapViewController({ center }: { center: [number, number] }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

type EventChanges = Pick<LogEvent, 'title' | 'type' | 'lat' | 'lng'>;

interface EventPopupProps {
  event: LogEvent;
  quickLogs: QuickLogConfig[];
  /** Liefert true, wenn gespeichert werden konnte. */
  onSave: (id: string, changes: EventChanges) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
}

function EventPopup({ event, quickLogs, onSave, onRequestDelete }: EventPopupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<LogType>(event.type);
  const [lat, setLat] = useState(String(event.lat));
  const [lng, setLng] = useState(String(event.lng));
  const { notify } = useToast();

  const startEditing = () => {
    setTitle(event.title);
    setType(event.type);
    setLat(String(event.lat));
    setLng(String(event.lng));
    setIsEditing(true);
  };

  const handleSave = async () => {
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (isNaN(latNum) || isNaN(lngNum)) {
      notify('Ungültige Koordinaten.', 'danger');
      return;
    }
    const saved = await onSave(event.id!, {
      title: title.trim() || event.title,
      type,
      lat: latNum,
      lng: lngNum
    });
    if (saved) setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="map-popup">
        <strong>{event.title}</strong>
        <div className="helper-text">
          {event.author} ·{' '}
          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="helper-text">
          {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
        </div>
        <Button variant="secondary" fullWidth onClick={startEditing}>
          <Pencil size={14} /> Bearbeiten
        </Button>
      </div>
    );
  }

  return (
    <div className="map-popup stack">
      <span className="label">Ereignis bearbeiten</span>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" />
      <Select value={type} onChange={(e) => setType(e.target.value as LogType)}>
        {quickLogs.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
        {/* Legacy-/gelöschte Kategorie: aktuellen Wert trotzdem anzeigen */}
        {!quickLogs.some((q) => q.id === type) && <option value={type}>{type}</option>}
      </Select>
      <div className="row">
        <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Breitengrad" />
        <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Längengrad" />
      </div>
      <div className="row">
        <Button fullWidth onClick={handleSave}>
          Speichern
        </Button>
        <Button variant="destructive" fullWidth onClick={() => onRequestDelete(event.id!)}>
          Löschen
        </Button>
      </div>
    </div>
  );
}

export default function MapTab({ user }: { user: string }) {
  const { position } = useTracking();
  const quickLogs = useQuickLogs();
  const track = useCollection<GpsPoint>('track');
  const events = useCollection<LogEvent>('events');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { notify } = useToast();

  const line: [number, number][] = track.map((p) => [p.lat, p.lng]);

  const center: [number, number] = position
    ? [position.lat, position.lng]
    : line.length > 0
      ? line[line.length - 1]
      : FALLBACK_CENTER;

  const handleSaveEdit = async (id: string, changes: EventChanges) => {
    try {
      await updateDoc(doc(db, 'events', id), changes);
      notify('Ereignis aktualisiert', 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
      return false;
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, 'events', deleteTargetId));
      notify('Ereignis gelöscht', 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Löschen.', 'danger');
    }
    setDeleteTargetId(null);
  };

  return (
    <div className="map-view">
      <MapContainer center={center} zoom={13} className="map-canvas">
        <MapViewController center={center} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" />

        {line.length > 1 && <Polyline positions={line} color={TRACK_COLOR} weight={4} />}

        {position && (
          <Marker position={[position.lat, position.lng]} icon={userIcon(getUserColor(user))}>
            <Popup>
              <div className="map-popup">
                <strong>Aktuelle Position ({user})</strong>
                <div className="helper-text">{position.speedKmh} km/h</div>
              </div>
            </Popup>
          </Marker>
        )}

        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={userIcon(getUserColor(evt.author))}>
            <Popup minWidth={200}>
              <EventPopup
                event={evt}
                quickLogs={quickLogs}
                onSave={handleSaveEdit}
                onRequestDelete={setDeleteTargetId}
              />
            </Popup>
          </Marker>
        ))}
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
