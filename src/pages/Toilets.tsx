import { useId, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Bath, CalendarDays, MapPin, Pencil, Plus, User, Users } from 'lucide-react';
import { OfflineTileLayer } from '../components/OfflineTileLayer';
import { dotIcon } from '../components/LiveMap';
import { BarRow, StatTile } from '../components/StatTile';
import { useToiletStops, ToiletStopChanges } from '../hooks/useToiletStops';
import { useTracking } from '../hooks/useTracking';
import { usePreferences } from '../hooks/usePreferences';
import { useSoftDelete } from '../hooks/useSoftDelete';
import { getBaseLayer } from '../lib/mapLayers';
import { readMapView } from '../lib/mapView';
import { getUserColor } from '../lib/userColors';
import {
  averagePerDay,
  bristolCounts,
  bristolLabelKey,
  bristolTendency,
  BRISTOL_TYPES,
  countsByAuthor,
  DEFAULT_BRISTOL_TYPE,
  DEFAULT_PLACE_TYPE,
  dominantBristolType,
  isBristolType,
  isToiletPlaceType,
  placeLabelKey,
  tendencyLabelKey,
  TOILET_PLACE_TYPES,
  TOILET_STOPS
} from '../lib/toiletStops';
import { BristolType, ToiletDetail, ToiletPlaceType, ToiletStop } from '../types';
import { useI18n, useT } from '../i18n';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Section,
  Select,
  useToast
} from '../components/ui';
import 'leaflet/dist/leaflet.css';
// Popup und Punktmarker sehen aus wie auf dem Kartentab – dessen Stile
// gelten hier mit, statt sie ein zweites Mal zu beschreiben.
import './MapTab.css';
import './Toilets.css';

/** Nimmt Kartentipps entgegen, solange „Auf Karte setzen" läuft. */
function MapPicker({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => {
      if (active) onPick(event.latlng.lat, event.latlng.lng);
    }
  });
  return null;
}

/** Auswahl der sieben Bristol-Typen – dieselbe Liste beim Anlegen und Ändern. */
function BristolSelect({
  id,
  value,
  onChange
}: {
  id?: string;
  value: BristolType;
  onChange: (value: BristolType) => void;
}) {
  const t = useT();
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (isBristolType(next)) onChange(next);
      }}
    >
      {BRISTOL_TYPES.map((type) => (
        <option key={type} value={type}>
          {t(bristolLabelKey(type))}
        </option>
      ))}
    </Select>
  );
}

function PlaceSelect({
  id,
  value,
  onChange
}: {
  id?: string;
  value: ToiletPlaceType;
  onChange: (value: ToiletPlaceType) => void;
}) {
  const t = useT();
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (isToiletPlaceType(next)) onChange(next);
      }}
    >
      {TOILET_PLACE_TYPES.map((type) => (
        <option key={type} value={type}>
          {t(placeLabelKey(type))}
        </option>
      ))}
    </Select>
  );
}

interface StopPopupProps {
  stop: ToiletStop;
  /** Nur bei eigenen Stopps vorhanden – fremde Beschreibungen kommen gar nicht erst an. */
  detail: ToiletDetail | undefined;
  isMine: boolean;
  canEdit: boolean;
  onSave: (stop: ToiletStop, changes: ToiletStopChanges) => void;
  onRequestDelete: (id: string) => void;
}

/**
 * Was an einem Marker steht.
 *
 * Für alle: wann, von wem, was für ein Ort. Für die eigene Person zusätzlich
 * die Beschreibung und der Weg zum Ändern – fremde Beschreibungen fehlen
 * nicht nur in der Anzeige, sie liegen gar nicht auf dem Gerät (siehe
 * hooks/useToiletStops.ts).
 */
function StopPopup({ stop, detail, isMine, canEdit, onSave, onRequestDelete }: StopPopupProps) {
  const { locale } = useI18n();
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [bristolType, setBristolType] = useState<BristolType>(detail?.bristolType ?? DEFAULT_BRISTOL_TYPE);
  const [placeType, setPlaceType] = useState<ToiletPlaceType>(stop.placeType);
  const [lat, setLat] = useState(String(stop.lat));
  const [lng, setLng] = useState(String(stop.lng));
  const { notify } = useToast();
  const when = new Date(stop.timestamp);

  const startEditing = () => {
    setBristolType(detail?.bristolType ?? DEFAULT_BRISTOL_TYPE);
    setPlaceType(stop.placeType);
    setLat(String(stop.lat));
    setLng(String(stop.lng));
    setIsEditing(true);
  };

  const handleSave = () => {
    const latNum = parseFloat(lat.replace(',', '.'));
    const lngNum = parseFloat(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      notify(t('map.invalidCoordinates'), 'danger');
      return;
    }
    onSave(stop, { lat: latNum, lng: lngNum, placeType, bristolType });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="map-popup stack">
        <span className="label">{t('toilets.editStop')}</span>
        <BristolSelect value={bristolType} onChange={setBristolType} />
        <PlaceSelect value={placeType} onChange={setPlaceType} />
        <div className="row">
          <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder={t('map.latitude')} />
          <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder={t('map.longitude')} />
        </div>
        <div className="row">
          <Button fullWidth onClick={handleSave}>
            {t('common.save')}
          </Button>
          <Button variant="destructive" fullWidth onClick={() => onRequestDelete(stop.id!)}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="map-popup">
      <strong>{t(placeLabelKey(stop.placeType))}</strong>
      <div className="helper-text">
        {stop.author} · {when.toLocaleDateString(locale)}{' '}
        {when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
      </div>
      {/* Die Beschreibung steht nur bei den eigenen Stopps – bei fremden sagt
          die Zeile, dass da nichts fehlt, sondern nichts hingehört. */}
      <div className="helper-text">
        {isMine ? (detail ? t(bristolLabelKey(detail.bristolType)) : t('toilets.noDetails')) : t('toilets.detailPrivate')}
      </div>
      {isMine && canEdit && (
        <Button variant="secondary" fullWidth onClick={startEditing}>
          <Pencil size={14} /> {t('map.editButton')}
        </Button>
      )}
    </div>
  );
}

/**
 * Toiletten: Zähler und Karte der eingetragenen Stopps.
 *
 * Bewusst ein eigener Tab unter „Mehr" und nicht im Logbuch: Das Logbuch ist
 * die Chronik der Reise, die man abends durchblättert und als Tagesbild teilt –
 * dort haben diese Einträge nichts verloren. Sie tauchen deshalb weder unter
 * den Ereignissen noch auf dem Kartentab, im Tagesbild, in der Statistik oder
 * im Export auf; sie leben ausschließlich hier.
 *
 * Geteilt ist der Marker, privat die Beschreibung – warum das zwei Collections
 * braucht, steht in lib/toiletStops.ts.
 */
export default function Toilets() {
  const { position } = useTracking();
  const { preferences } = usePreferences();
  const { locale } = useI18n();
  const t = useT();
  const { notify } = useToast();
  const toilets = useToiletStops();
  const { stops, myStops, myDetails, detailById, canEdit, isMine } = toilets;
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    TOILET_STOPS,
    'toilets.trashed',
    'toilets.restored'
  );

  const bristolId = useId();
  const placeId = useId();
  const [bristolType, setBristolType] = useState<BristolType>(DEFAULT_BRISTOL_TYPE);
  const [placeType, setPlaceType] = useState<ToiletPlaceType>(DEFAULT_PLACE_TYPE);
  const [placing, setPlacing] = useState(false);

  const baseLayer = getBaseLayer(preferences.baseLayer);
  // Beim Einhängen einmal gelesen (MapContainer wertet center/zoom nur initial
  // aus): am liebsten über dem jüngsten Stopp, sonst dort, wo die Karte des
  // Roadtrips zuletzt stand.
  const [fallbackView] = useState(readMapView);
  const newest = stops[0];
  const center: [number, number] = newest
    ? [newest.lat, newest.lng]
    : [fallbackView.lat, fallbackView.lng];

  const crew = useMemo(() => countsByAuthor(stops), [stops]);
  const distribution = useMemo(() => bristolCounts(myDetails), [myDetails]);
  const dominant = useMemo(() => dominantBristolType(myDetails), [myDetails]);
  const crewMax = crew[0]?.count ?? 0;
  const distributionMax = distribution.reduce((max, entry) => Math.max(max, entry.count), 0);
  const perDay = averagePerDay(stops);

  const addStop = (lat: number, lng: number) => {
    if (!toilets.add({ lat, lng, placeType, bristolType })) return;
    notify(t('toilets.added'), 'success');
  };

  const handleAddHere = () => {
    if (!position) {
      notify(t('toilets.noPosition'), 'danger');
      return;
    }
    addStop(position.lat, position.lng);
  };

  // Nach einem gesetzten Stopp endet der Setzmodus wieder: Sonst legt der
  // nächste Tipp auf die Karte – etwa um einen Marker anzusehen – gleich den
  // nächsten Eintrag an.
  const handlePick = (lat: number, lng: number) => {
    setPlacing(false);
    addStop(lat, lng);
  };

  const handleSave = (stop: ToiletStop, changes: ToiletStopChanges) => {
    toilets.update(stop, changes);
    notify(t('toilets.updated'), 'success');
  };

  return (
    <div className="toilets-page">
      <PageHeader title={t('toilets.title')} subtitle={t('toilets.subtitle')} />

      <div className="stat-grid">
        <StatTile
          icon={<Bath size={16} strokeWidth={1.75} />}
          label={t('toilets.total')}
          value={String(stops.length)}
        />
        <StatTile
          icon={<User size={16} strokeWidth={1.75} />}
          label={t('toilets.mine')}
          value={String(myStops.length)}
        />
        <StatTile
          icon={<CalendarDays size={16} strokeWidth={1.75} />}
          label={t('toilets.perDay')}
          value={perDay > 0 ? perDay.toLocaleString(locale, { maximumFractionDigits: 1 }) : '–'}
          hint={t('toilets.perDayHint')}
        />
      </div>

      <Section title={t('toilets.addSection')}>
        <div className="stack">
          <p className="helper-text">{t('toilets.privacyNote')}</p>

          <div className="field">
            <label className="label" htmlFor={bristolId}>
              {t('toilets.bristolLabel')}
            </label>
            <BristolSelect id={bristolId} value={bristolType} onChange={setBristolType} />
          </div>

          <div className="field">
            <label className="label" htmlFor={placeId}>
              {t('toilets.placeLabel')}
            </label>
            <PlaceSelect id={placeId} value={placeType} onChange={setPlaceType} />
          </div>

          <div className="row">
            <Button fullWidth disabled={!canEdit || !position} onClick={handleAddHere}>
              <Plus size={18} /> {t('toilets.addHere')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={!canEdit}
              aria-pressed={placing}
              onClick={() => setPlacing((open) => !open)}
            >
              <MapPin size={18} /> {placing ? t('toilets.placeOnMapStop') : t('toilets.placeOnMap')}
            </Button>
          </div>

          <p className="helper-text">
            {placing ? t('toilets.placeOnMapHint') : position ? t('toilets.addHereHint') : t('toilets.noPosition')}
          </p>
          {!canEdit && <p className="helper-text">{t('crew.readonlyHint')}</p>}
        </div>
      </Section>

      <Section title={t('toilets.mapSection')}>
        <div className="stack">
          <MapContainer
            center={center}
            zoom={newest ? 12 : fallbackView.zoom}
            className={`toilets-map ${placing ? 'toilets-map-placing' : ''}`}
            scrollWheelZoom
          >
            <OfflineTileLayer
              key={preferences.baseLayer}
              url={baseLayer.url}
              attribution={baseLayer.attribution}
              maxZoom={baseLayer.maxZoom}
              maxNativeZoom={baseLayer.maxNativeZoom}
            />
            <MapPicker active={placing} onPick={handlePick} />

            {stops.map((stop) => {
              const mine = isMine(stop);
              return (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={dotIcon(getUserColor(stop.author))}
                  // Verschieben nur am eigenen Marker: Ein fremder Eintrag
                  // gehört jemand anderem, auch wenn die Regeln der Crew das
                  // Ändern technisch erlauben.
                  draggable={mine && canEdit}
                  eventHandlers={{
                    dragend: (event) => {
                      const { lat, lng } = event.target.getLatLng();
                      handleSave(stop, { lat, lng });
                    }
                  }}
                >
                  <Popup minWidth={210}>
                    <StopPopup
                      stop={stop}
                      detail={detailById.get(stop.id!)}
                      isMine={mine}
                      canEdit={canEdit}
                      onSave={handleSave}
                      onRequestDelete={requestDelete}
                    />
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {stops.length === 0 ? (
            <EmptyState
              icon={<Bath size={26} strokeWidth={1.5} />}
              title={t('toilets.empty')}
              hint={t('toilets.emptyHint')}
            />
          ) : (
            <p className="helper-text">{t('toilets.dragHint')}</p>
          )}
        </div>
      </Section>

      {crew.length > 0 && (
        <Section title={t('toilets.crewSection')}>
          <div className="stat-bars">
            {crew.map((entry) => (
              <BarRow
                key={entry.author}
                label={
                  <span className="toilets-crew-name">
                    <Users size={13} strokeWidth={1.75} color={getUserColor(entry.author)} />
                    {entry.author}
                  </span>
                }
                value={t('toilets.stopCount', { count: entry.count })}
                ratio={crewMax > 0 ? entry.count / crewMax : 0}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('toilets.distributionSection')}>
        {myDetails.length === 0 ? (
          <p className="helper-text">{t('toilets.noDetails')}</p>
        ) : (
          <>
            <p className="helper-text">{t('toilets.distributionHint')}</p>
            <div className="stat-bars">
              {distribution.map((entry) => (
                <BarRow
                  key={entry.type}
                  label={t(bristolLabelKey(entry.type))}
                  hint={t(tendencyLabelKey(bristolTendency(entry.type)))}
                  value={String(entry.count)}
                  ratio={distributionMax > 0 ? entry.count / distributionMax : 0}
                />
              ))}
            </div>
            {dominant && (
              <p className="helper-text toilets-dominant">
                {t('toilets.dominant')}: {t(bristolLabelKey(dominant))}
              </p>
            )}
          </>
        )}
      </Section>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('toilets.deleteTitle')}
        description={t('toilets.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
