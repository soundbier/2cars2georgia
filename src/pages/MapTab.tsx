import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { doc, updateDoc } from 'firebase/firestore';
import { Pencil, LocateFixed, Navigation, DownloadCloud } from 'lucide-react';
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
import { usePreferences, MapElementSize } from '../hooks/usePreferences';
import { getUserColor } from '../lib/userColors';
import { formatSpeed } from '../lib/units';
import { getBaseLayer, OVERLAYS, OVERLAY_IDS } from '../lib/mapLayers';
import { dotIcon, FollowController, MapTiles, PositionMarker } from '../components/LiveMap';
import {
  OfflineDownloadPanel,
  OfflineGrid,
  useOfflineDownload
} from '../components/OfflineMapDownload';
import { PlannedRouteLine } from '../components/RoutePlanner';
import { useActivePlannedRoute } from '../hooks/usePlannedRoutes';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { readMapView, saveMapView } from '../lib/mapView';
import { activeOnly } from '../lib/trash';
import { useI18n, useT } from '../i18n';
import { GpsPoint, LogEvent, LogType, QuickLogConfig } from '../types';
import { Button, Input, Select, useToast, ConfirmDialog } from '../components/ui';
import './MapTab.css';

// Leaflet setzt die Linienfarbe als SVG-Attribut – dort werden CSS-Variablen
// nicht aufgelöst, deshalb hier der Literalwert von --terracotta
// (styles/tokens.css). Terracotta ist die Farbe der aktiven Spur; die weiße
// Konturlinie darunter bleibt, weil die Route sonst auf Satellit und Topo
// im Untergrund verschwindet.
const TRACK_COLOR = '#bc4f27';
const TRACK_CASING_COLOR = '#ffffff';

/**
 * Kleinste Kursänderung, die im Fahrmodus die Karte dreht.
 *
 * GPS-Kurse zappeln auch bei gerader Fahrt um ein paar Grad – ohne diese
 * Schwelle wackelte die Karte dauernd unter dem Finger.
 */
const MIN_HEADING_CHANGE_DEG = 3;

/**
 * Kantenlänge der Ereignis-Marker je Größenstufe, in Pixeln.
 *
 * Klein für Tage mit vielen Logs auf engem Raum, groß für die Fahrt, bei der
 * man im Vorbeischauen erkennen will, wo etwas war.
 */
const EVENT_MARKER_SIZE: Record<MapElementSize, number> = {
  small: 11,
  medium: 16,
  large: 24
};

/**
 * Maß der schwebenden Kartenknöpfe je Größenstufe: Kantenlänge des Knopfs und
 * Größe des Symbols darin. Die Kantenlänge geht als CSS-Variable an
 * `.map-controls` (siehe MapTab.css), das Symbol bekommt sie direkt.
 */
const CONTROL_SIZE: Record<MapElementSize, { button: number; icon: number }> = {
  small: { button: 36, icon: 16 },
  medium: { button: 44, icon: 20 },
  large: { button: 56, icon: 26 }
};

/** Kürzester Winkelabstand zwischen zwei Kursen, in Grad (-180 … 180). */
function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/** Kompassnadel: rote Hälfte nach Norden, graue nach Süden. */
function CompassNeedle({ bearing, size }: { bearing: number; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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
  // Anzeigegrößen aus den Einstellungen (Einstellungen → Karte): wie groß die
  // Ereignis-Marker sind und wie groß die Knöpfe am Kartenrand.
  const eventMarkerSize = EVENT_MARKER_SIZE[preferences.mapEventSize];
  const controlSize = CONTROL_SIZE[preferences.mapControlSize];
  // Gemerkt statt bei jedem Render neu gebaut: Im Fahrmodus rendert diese
  // Seite häufig (Kurs, Folgen-Schalter, Toasts), und ein frisches Array
  // zwänge Leaflet jedes Mal, die gesamte Spur neu zu zeichnen – bei einer
  // Reise mit zehntausenden Punkten genau dann spürbar, wenn jemand fährt.
  const line = useMemo<[number, number][]>(
    () => track.map((p) => [p.lat, p.lng]),
    [track]
  );
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

        <MapTiles />

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

        {/* Ereignisse sind abschaltbar (Einstellungen → Karte): Nach ein paar
            Tagen liegen Dutzende Marker auf der Strecke. Ausgeblendet heißt
            nur ausgeblendet – im Logbuch stehen sie weiter. */}
        {preferences.showMapEvents &&
          events.map((evt) => (
            <Marker
              key={evt.id}
              position={[evt.lat, evt.lng]}
              icon={dotIcon(getUserColor(evt.author), eventMarkerSize)}
            >
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

      {/* Die Kantenlänge kommt aus den Einstellungen und geht als Variable an
          die Gruppe – die Knöpfe selbst lesen sie in MapTab.css. */}
      <div
        className="map-controls"
        style={{ '--map-control-size': `${controlSize.button}px` } as CSSProperties}
      >
        <button
          type="button"
          className={`map-control map-control-compass ${northUp ? 'map-control-active' : ''}`}
          onClick={toggleNorthUp}
          aria-pressed={northUp}
          aria-label={northUp ? t('map.unlockNorth') : t('map.lockNorth')}
          title={northUp ? t('map.unlockNorth') : t('map.lockNorth')}
        >
          <CompassNeedle bearing={bearing} size={controlSize.icon} />
        </button>
        <button
          type="button"
          className={`map-control ${driveMode ? 'map-control-active' : ''}`}
          onClick={toggleDriveMode}
          aria-pressed={driveMode}
          aria-label={driveMode ? t('map.driveModeOff') : t('map.driveModeOn')}
          title={driveMode ? t('map.driveModeOff') : t('map.driveModeOn')}
        >
          <Navigation size={controlSize.icon} />
        </button>
        <button
          type="button"
          className={`map-control ${offline.active ? 'map-control-active' : ''}`}
          onClick={offline.active ? offline.close : offline.open}
          aria-pressed={offline.active}
          aria-label={offline.active ? t('map.offlineClose') : t('map.offlineDownload')}
          title={offline.active ? t('map.offlineClose') : t('map.offlineDownload')}
        >
          <DownloadCloud size={controlSize.icon} />
        </button>
        <button
          type="button"
          className={`map-control ${follow ? 'map-control-active' : ''}`}
          onClick={centerOnUser}
          aria-pressed={follow}
          aria-label={follow ? t('map.unfollow') : t('map.centerOnPosition')}
          title={follow ? t('map.unfollow') : t('map.centerOnPosition')}
        >
          <LocateFixed size={controlSize.icon} />
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
