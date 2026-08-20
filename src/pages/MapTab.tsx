import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { MapContainer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { doc, updateDoc } from 'firebase/firestore';
import { Pencil, LocateFixed, Navigation, DownloadCloud } from 'lucide-react';
import L from 'leaflet';
// Seiteneffekt-Import: erweitert Leaflet um die Kartendrehung (map.setBearing).
import 'leaflet-rotate';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useTracking } from '../hooks/useTracking';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { usePermissions } from '../hooks/usePermissions';
import { useSoftDelete } from '../hooks/useSoftDelete';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getUserColor } from '../lib/userColors';
import { formatSpeed } from '../lib/units';
import { getBaseLayer, OVERLAYS, OVERLAY_IDS } from '../lib/mapLayers';
import { OfflineTileLayer } from '../components/OfflineTileLayer';
import {
  OfflineDownloadPanel,
  OfflineGrid,
  useOfflineDownload
} from '../components/OfflineMapDownload';
import { PlannedRouteLine, useActivePlannedRoute } from '../components/RoutePlanner';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { readMapView, saveMapView } from '../lib/mapView';
import { activeOnly } from '../lib/trash';
import { useI18n, useT } from '../i18n';
import { GpsPoint, LivePosition, LogEvent, LogType, QuickLogConfig } from '../types';
import { Button, Input, Select, useToast, ConfirmDialog } from '../components/ui';
import 'leaflet/dist/leaflet.css';
import './MapTab.css';

// Leaflet setzt die Linienfarbe als SVG-Attribut – dort werden CSS-Variablen
// nicht aufgelöst, deshalb hier der Literalwert von --terracotta
// (styles/tokens.css). Terracotta ist die Farbe der aktiven Spur; die weiße
// Konturlinie darunter bleibt, weil die Route sonst auf Satellit und Topo
// im Untergrund verschwindet.
const TRACK_COLOR = '#bc4f27';
const TRACK_CASING_COLOR = '#ffffff';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Kleinste Kursänderung, die im Fahrmodus die Karte dreht.
 *
 * GPS-Kurse zappeln auch bei gerader Fahrt um ein paar Grad – ohne diese
 * Schwelle wackelte die Karte dauernd unter dem Finger.
 */
const MIN_HEADING_CHANGE_DEG = 3;

/** Kürzester Winkelabstand zwischen zwei Kursen, in Grad (-180 … 180). */
function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

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

/**
 * Bedient die Ausrichtung der Karte: Nordfixierung, Fahrmodus und die Frage,
 * ob überhaupt von Hand gedreht werden darf.
 *
 * Beide Modi sperren die Drehgesten. Das ist nicht nur Zierde: Die
 * Zwei-Finger-Geste von leaflet-rotate hängt an derselben Auswertung wie der
 * Pinch-Zoom und dreht die Karte schon bei minimaler Schräglage der Finger
 * kräftig mit. Wer zoomen will, soll nur zoomen.
 */
function BearingController({
  northUp,
  driveMode,
  headingDeg
}: {
  northUp: boolean;
  driveMode: boolean;
  headingDeg: number | null;
}) {
  const map = useMap();
  const locked = northUp || driveMode;
  // Zuletzt gefahrener Kurs – verhindert, dass jede Rundungsstelle des GPS
  // eine neue Drehung auslöst.
  const appliedHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    if (locked) {
      map.touchRotate.disable();
      map.shiftKeyRotate.disable();
      // Das Plugin schaltet beim Shift-Drehen den Radzoom ab und erst beim
      // nächsten Rad-Ereignis ohne Shift wieder an – ohne den Handler käme
      // dieses Ereignis nie an.
      map.scrollWheelZoom.enable();
    } else {
      map.touchRotate.enable();
      map.shiftKeyRotate.enable();
    }
  }, [map, locked]);

  useEffect(() => {
    if (northUp) map.setBearing(0);
  }, [map, northUp]);

  useEffect(() => {
    if (!driveMode) {
      appliedHeadingRef.current = null;
      return;
    }
    // Ohne gültigen Kurs (im Hafen, Gerät ohne Kompass) bleibt die Karte
    // stehen, statt sich auf einen zufälligen Wert zu drehen.
    if (headingDeg === null || !Number.isFinite(headingDeg)) return;

    const applied = appliedHeadingRef.current;
    if (applied !== null && Math.abs(angleDelta(headingDeg, applied)) < MIN_HEADING_CHANGE_DEG) return;

    appliedHeadingRef.current = headingDeg;
    // Positives Bearing dreht den Karteninhalt im Uhrzeigersinn: Damit der
    // Kurs oben liegt, muss gegen den Kurs gedreht werden.
    map.setBearing(-headingDeg);
  }, [map, driveMode, headingDeg]);

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
  canEdit: boolean;
  /** Liefert true, wenn gespeichert werden konnte. */
  onSave: (id: string, changes: EventChanges) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
}

function EventPopup({ event, quickLogs, canEdit, onSave, onRequestDelete }: EventPopupProps) {
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
        {canEdit && (
          <Button variant="secondary" fullWidth onClick={startEditing}>
            <Pencil size={14} /> {t('map.editButton')}
          </Button>
        )}
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
  const { canEdit } = usePermissions(user);
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null);
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'events',
    'map.eventTrashed',
    'map.eventRestored'
  );
  const { notify } = useToast();
  const t = useT();

  // Was im Papierkorb liegt, gehört auch nicht mehr als Marker auf die Karte.
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);

  // Beim Einhängen einmal gelesen: MapContainer wertet center/zoom nur initial
  // aus, alles Weitere läuft über die Map-Instanz.
  const [initialView] = useState(readMapView);
  const [bearing, setBearing] = useState(initialView.bearing);
  const [follow, setFollow] = useState(initialView.follow);
  const [northUp, setNorthUp] = useState(initialView.northUp);
  const [driveMode, setDriveMode] = useState(initialView.driveMode);

  const baseLayer = getBaseLayer(preferences.baseLayer);
  const line: [number, number][] = track.map((p) => [p.lat, p.lng]);
  const isOnline = useOnlineStatus();

  // Offline gespeichert wird genau das, was auch angezeigt wird: die gewählte
  // Grundkarte samt eingeschalteter Overlays.
  const offlineLayers = useMemo(
    () => [
      { id: preferences.baseLayer, url: baseLayer.url },
      ...OVERLAY_IDS.filter((id) => preferences.overlays[id]).map((id) => ({
        id,
        url: OVERLAYS[id].url
      }))
    ],
    [preferences.baseLayer, preferences.overlays, baseLayer.url]
  );

  const handleDownloadFinished = useCallback(
    ({ failed, aborted }: { failed: number; aborted: boolean }) => {
      if (aborted) notify(t('map.offlineAborted'), 'info');
      else if (failed > 0) notify(t('map.offlineFailed', { count: failed }), 'danger');
      else notify(t('map.offlineDone'), 'success');
    },
    [notify, t]
  );

  // Abgesteckt wird im Routenplaner (pages/RoutePlanner); hier zählt nur die
  // dort aktivierte Route. Sie hat Vorrang vor dem Track: Wer sie gewählt hat,
  // will die Karten für die geplante Strecke, der Track deckt nur die bereits
  // gefahrene ab. Erst ab zwei Wegpunkten ist es eine Strecke.
  const plannedRoute = useActivePlannedRoute();
  const plannedWaypoints = useMemo(() => plannedRoute?.waypoints ?? [], [plannedRoute]);
  const hasPlannedRoute = plannedWaypoints.length > 1;
  const offlineRoute = hasPlannedRoute ? plannedWaypoints : track;

  const offline = useOfflineDownload(offlineRoute, offlineLayers, handleDownloadFinished);

  useEffect(() => {
    saveMapView({ follow, northUp, driveMode });
  }, [follow, northUp, driveMode]);

  // Wer die Karte selbst verschiebt, will dort bleiben. Im Fahrmodus gilt das
  // nicht: Dort soll das Schiff in der Mitte bleiben, ein Schubs zum Vorausblick
  // wird mit dem nächsten GPS-Fix wieder eingefangen. Beenden lässt sich das
  // Folgen dort über den Zentrierknopf.
  const stopFollowing = useCallback(() => {
    if (!driveMode) setFollow(false);
  }, [driveMode]);

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

  // Nordfixierung und Fahrmodus schließen sich aus – beide bestimmen die
  // Ausrichtung, also darf immer nur einer davon das Sagen haben.
  const toggleNorthUp = () => {
    if (northUp) {
      setNorthUp(false);
      return;
    }
    setDriveMode(false);
    setNorthUp(true);
  };

  const toggleDriveMode = () => {
    if (driveMode) {
      setDriveMode(false);
      return;
    }
    setNorthUp(false);
    setDriveMode(true);
    // Im Fahrmodus gehört das Schiff in die Bildmitte; die Zoomstufe bleibt.
    setFollow(true);
    // Ohne Kurs bleibt die Karte stehen, bis das GPS einen liefert – ein
    // stiller Knopf sähe nach einem Fehler aus.
    if (position?.headingDeg == null) notify(t('map.driveModeNoHeading'), 'info');
  };

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

  return (
    <div className="map-view">
      <MapContainer
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
        <BearingController
          northUp={northUp}
          driveMode={driveMode}
          headingDeg={position?.headingDeg ?? null}
        />

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

        {/* Die geplante Route bleibt sichtbar, damit erkennbar ist, wofür
            das Downloadraster gilt. */}
        <PlannedRouteLine waypoints={plannedWaypoints} />

        {offline.active && (
          <OfflineGrid
            cells={offline.cells}
            selected={offline.selected}
            downloaded={offline.downloaded}
            onToggle={offline.toggleCell}
            disabled={offline.busy}
          />
        )}

        {line.length > 1 && (
          <>
            {/* Heller Rand unter der eigentlichen Linie: hebt die Route auch
                auf dunklen Kartenausschnitten (Satellit, Topo) klar ab, statt
                nur auf hellem Untergrund gut lesbar zu sein. */}
            <Polyline
              positions={line}
              pathOptions={{
                color: TRACK_CASING_COLOR,
                weight: 7,
                opacity: 0.6,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            <Polyline
              positions={line}
              pathOptions={{
                color: TRACK_COLOR,
                weight: 4,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          </>
        )}

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
                canEdit={canEdit}
                onSave={handleSaveEdit}
                onRequestDelete={requestDelete}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-controls">
        <button
          type="button"
          className={`map-control map-control-compass ${northUp ? 'map-control-active' : ''}`}
          onClick={toggleNorthUp}
          aria-pressed={northUp}
          aria-label={northUp ? t('map.unlockNorth') : t('map.lockNorth')}
          title={northUp ? t('map.unlockNorth') : t('map.lockNorth')}
        >
          <CompassNeedle bearing={bearing} />
        </button>
        <button
          type="button"
          className={`map-control ${driveMode ? 'map-control-active' : ''}`}
          onClick={toggleDriveMode}
          aria-pressed={driveMode}
          aria-label={driveMode ? t('map.driveModeOff') : t('map.driveModeOn')}
          title={driveMode ? t('map.driveModeOff') : t('map.driveModeOn')}
        >
          <Navigation size={20} />
        </button>
        <button
          type="button"
          className={`map-control ${offline.active ? 'map-control-active' : ''}`}
          onClick={offline.active ? offline.close : offline.open}
          aria-pressed={offline.active}
          aria-label={offline.active ? t('map.offlineClose') : t('map.offlineDownload')}
          title={offline.active ? t('map.offlineClose') : t('map.offlineDownload')}
        >
          <DownloadCloud size={20} />
        </button>
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

      {/* Offline-Status: nur dann sichtbar, wenn er etwas erklärt – ohne Netz
          oder solange der Downloadmodus offen ist. */}
      {!isOnline && !offline.active && (
        <div className="map-offline-badge">
          {offline.storedAreas > 0
            ? t('map.offlineStored', { count: offline.storedAreas })
            : t('map.offlineNone')}
        </div>
      )}

      {offline.active && (
        <OfflineDownloadPanel
          state={offline}
          isOnline={isOnline}
          sourceLabel={
            hasPlannedRoute
              ? t('map.offlineSourcePlanned', {
                  name: plannedRoute?.name || t('plan.unnamed')
                })
              : t('map.offlineSourceTrack')
          }
        />
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('map.deleteEventTitle')}
        description={t('map.deleteEventDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
