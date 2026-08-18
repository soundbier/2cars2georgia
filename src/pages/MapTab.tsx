import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { Pencil, LocateFixed } from 'lucide-react';
import L from 'leaflet';
// Seiteneffekt-Import: erweitert Leaflet um die Kartendrehung (map.setBearing).
import 'leaflet-rotate';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useTracking } from '../hooks/useTracking';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getUserColor } from '../lib/userColors';
import { formatSpeed } from '../lib/units';
import { getBaseLayer, OVERLAYS, OVERLAY_IDS } from '../lib/mapLayers';
import { readMapView, saveMapView } from '../lib/mapView';
import { activeOnly } from '../lib/trash';
import { useI18n, useT } from '../i18n';
import { GpsPoint, LivePosition, LogEvent, LogType, QuickLogConfig } from '../types';
import { Button, Input, Select, useToast, ConfirmDialog } from '../components/ui';
import 'leaflet/dist/leaflet.css';
import './MapTab.css';

// Leaflet setzt die Linienfarbe als SVG-Attribut – dort werden CSS-Variablen
// nicht aufgelöst, deshalb hier der Literalwert von --color-accent.
const TRACK_COLOR = '#0284c7';

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
function dotIcon(color: string): L.DivIcon {
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
function boatIcon(color: string): L.DivIcon {
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

/** Kompassnadel: rote Hälfte nach Norden, graue nach Süden. */
function CompassNeedle({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      style={{ transform: `rotate(${bearing}deg)` }}
    >
      <path d="M12 2.5 L16 12 L12 12 Z" fill="#dc2626" />
      <path d="M12 2.5 L8 12 L12 12 Z" fill="#f87171" />
      <path d="M12 21.5 L16 12 L12 12 Z" fill="#94a3b8" />
      <path d="M12 21.5 L8 12 L12 12 Z" fill="#cbd5e1" />
    </svg>
  );
}

/**
 * Hält den gespeicherten Ausschnitt aktuell und meldet Nutzerinteraktionen.
 *
 * Ohne das Speichern startete die Karte nach jedem Tab-Wechsel wieder über der
 * eigenen Position (siehe lib/mapView).
 */
function MapStateSync({
  onUserDrag,
  onBearingChange
}: {
  onUserDrag: () => void;
  onBearingChange: (bearing: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    // `rotate` feuert bei jedem Frame der Drehgeste – der Ausschnitt wird
    // deshalb erst nach dem Loslassen geschrieben, die Kompassnadel dagegen
    // sofort aktualisiert.
    let persistTimer: number | undefined;
    const persist = () => {
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        const center = map.getCenter();
        saveMapView({
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom(),
          bearing: map.getBearing()
        });
      }, 250);
    };
    const handleRotate = () => {
      onBearingChange(map.getBearing());
      persist();
    };

    map.on('moveend', persist);
    map.on('zoomend', persist);
    map.on('rotate', handleRotate);
    map.on('dragstart', onUserDrag);

    return () => {
      window.clearTimeout(persistTimer);
      map.off('moveend', persist);
      map.off('zoomend', persist);
      map.off('rotate', handleRotate);
      map.off('dragstart', onUserDrag);
    };
  }, [map, onUserDrag, onBearingChange]);

  return null;
}

/** Zieht die Karte der eigenen Position hinterher, solange „Folgen“ aktiv ist. */
function FollowController({ position, active }: { position: LivePosition | null; active: boolean }) {
  const map = useMap();
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (!active || lat === undefined || lng === undefined) return;
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [map, active, lat, lng]);

  return null;
}

function PositionMarker({
  position,
  user,
  children
}: {
  position: LivePosition;
  user: string;
  children: ReactNode;
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
  const { locale } = useI18n();
  const t = useT();

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
      notify(t('map.invalidCoordinates'), 'danger');
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
          {new Date(event.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="helper-text">
          {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
        </div>
        <Button variant="secondary" fullWidth onClick={startEditing}>
          <Pencil size={14} /> {t('map.editButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="map-popup stack">
      <span className="label">{t('map.editEvent')}</span>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('logbook.titlePlaceholder')} />
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
        <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder={t('map.latitude')} />
        <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder={t('map.longitude')} />
      </div>
      <div className="row">
        <Button fullWidth onClick={handleSave}>
          {t('common.save')}
        </Button>
        <Button variant="destructive" fullWidth onClick={() => onRequestDelete(event.id!)}>
          {t('common.delete')}
        </Button>
      </div>
    </div>
  );
}

export default function MapTab({ user }: { user: string }) {
  const { position } = useTracking();
  const { tripId } = useRoadtrip();
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { notify } = useToast();
  const t = useT();

  // Was im Papierkorb liegt, gehört auch nicht mehr als Marker auf die Karte.
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);

  // Beim Einhängen einmal gelesen: MapContainer wertet center/zoom nur initial
  // aus, alles Weitere läuft über die Map-Instanz.
  const [initialView] = useState(readMapView);
  const [map, setMap] = useState<L.Map | null>(null);
  const [bearing, setBearing] = useState(initialView.bearing);
  const [follow, setFollow] = useState(initialView.follow);

  const baseLayer = getBaseLayer(preferences.baseLayer);
  const line: [number, number][] = track.map((p) => [p.lat, p.lng]);

  useEffect(() => {
    saveMapView({ follow });
  }, [follow]);

  // Wer die Karte selbst verschiebt, will dort bleiben.
  const stopFollowing = useCallback(() => setFollow(false), []);

  const centerOnUser = () => {
    if (follow) {
      setFollow(false);
      return;
    }
    if (!position) {
      notify(t('map.noPosition'), 'danger');
      return;
    }
    // Das Zentrieren selbst übernimmt der FollowController, sobald „Folgen“
    // aktiv ist – die Zoomstufe bleibt dabei bewusst erhalten.
    setFollow(true);
  };

  const resetNorth = () => map?.setBearing(0);

  const handleSaveEdit = async (id: string, changes: EventChanges) => {
    if (!tripId) return false;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'events'), id), changes));
      notify(t('map.eventUpdated'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
      return false;
    }
  };

  const restoreEvent = async (id: string) => {
    if (!tripId) return;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'events'), id), { deletedAt: deleteField() }));
      notify(t('map.eventRestored'), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.restoreFailed'), 'danger');
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTargetId || !tripId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'events'), id), { deletedAt: Date.now() }));
      notify(t('map.eventTrashed'), 'success', {
        label: t('common.undo'),
        onAct: () => void restoreEvent(id)
      });
    } catch (err) {
      console.error(err);
      notify(t('common.deleteError'), 'danger');
    }
  };

  return (
    <div className="map-view">
      <MapContainer
        ref={setMap}
        center={[initialView.lat, initialView.lng]}
        zoom={initialView.zoom}
        className="map-canvas"
        // Drehen per Zwei-Finger-Geste, am Desktop mit gedrückter Shift-Taste.
        rotate
        touchRotate
        bearing={initialView.bearing}
        rotateControl={false}
      >
        <MapStateSync onUserDrag={stopFollowing} onBearingChange={setBearing} />
        <FollowController position={position} active={follow} />

        <TileLayer
          // Attribution und Zoomgrenzen gelten pro Quelle: neu einhängen statt
          // nur die URL auszutauschen.
          key={preferences.baseLayer}
          url={baseLayer.url}
          attribution={baseLayer.attribution}
          maxZoom={baseLayer.maxZoom}
          maxNativeZoom={baseLayer.maxNativeZoom}
        />
        {OVERLAY_IDS.filter((id) => preferences.overlays[id]).map((id) => (
          <TileLayer
            key={id}
            url={OVERLAYS[id].url}
            attribution={OVERLAYS[id].attribution}
            maxZoom={OVERLAYS[id].maxZoom}
            maxNativeZoom={OVERLAYS[id].maxNativeZoom}
          />
        ))}

        {line.length > 1 && <Polyline positions={line} color={TRACK_COLOR} weight={4} />}

        {position && (
          <PositionMarker position={position} user={user}>
            <Popup>
              <div className="map-popup">
                <strong>{t('map.currentPosition', { name: user })}</strong>
                <div className="helper-text">
                  {formatSpeed(position.speedKmh, preferences.unitSystem)}
                  {position.headingDeg !== null && ` · ${position.headingDeg}°`}
                </div>
              </div>
            </Popup>
          </PositionMarker>
        )}

        {events.map((evt) => (
          <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={dotIcon(getUserColor(evt.author))}>
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

      <div className="map-controls">
        {/* Nur sichtbar, wenn es etwas zurückzusetzen gibt. */}
        {Math.round(bearing) % 360 !== 0 && (
          <button
            type="button"
            className="map-control map-control-compass"
            onClick={resetNorth}
            aria-label={t('map.orientNorth')}
            title={t('map.orientNorth')}
          >
            <CompassNeedle bearing={bearing} />
          </button>
        )}
        <button
          type="button"
          className={`map-control ${follow ? 'map-control-active' : ''}`}
          onClick={centerOnUser}
          aria-pressed={follow}
          aria-label={follow ? t('map.unfollow') : t('map.centerOnPosition')}
          title={follow ? t('map.unfollow') : t('map.centerOnPosition')}
        >
          <LocateFixed size={20} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('map.deleteEventTitle')}
        description={t('map.deleteEventDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
