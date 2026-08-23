import { useCallback, useMemo, useState } from 'react';
import { MapContainer } from 'react-leaflet';
import { Check, Copy, MapPin, Pencil, Plus, Route as RouteIcon, Trash2, Undo2, Waypoints } from 'lucide-react';
import { OfflineTileLayer } from '../components/OfflineTileLayer';
import { RouteEditorLayer, useRouteEditor } from '../components/RoutePlanner';
import { RouteEditDialog } from '../components/RouteEditDialog';
import { useCollection } from '../hooks/useCollection';
import { usePlannedRoutes } from '../hooks/usePlannedRoutes';
import { useTrackSessions } from '../hooks/useTrackSessions';
import { usePreferences } from '../hooks/usePreferences';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { getBaseLayer } from '../lib/mapLayers';
import { readMapView } from '../lib/mapView';
import { formatDistance } from '../lib/units';
import { formatDuration } from '../lib/tripStats';
import { EMPTY_SESSION_STATS, sessionStatsById, SESSION_NAME_MAX_LENGTH } from '../lib/trackSession';
import {
  findRoute,
  PlannedRoute,
  plannedRouteLengthMeters,
  PlannedWaypoint
} from '../lib/plannedRoute';
import { GpsPoint, TrackSession } from '../types';
import { useI18n, useT } from '../i18n';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  ListItem,
  PageHeader,
  Section,
  useToast
} from '../components/ui';
import 'leaflet/dist/leaflet.css';
import './Settings.css';
import '../components/RoutePlanner.css';

/** Heute als ISO-Datum – Vorbelegung für eine neue Tagesroute. */
function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Routenmenü: geplante Routen und gefahrene Aufzeichnungen an einem Ort.
 *
 * Erreichbar über das "Mehr"-Dropup neben Kombüse und Einstellungen – hier
 * wird verwaltet, nicht navigiert; das passiert typischerweise vorher am
 * großen Bildschirm oder abends im Hafen, nicht während der Fahrt.
 *
 * Zwei Listen, die sich bewusst unterscheiden:
 *
 * * **Geplante Routen** (`roadtrips/{tripId}/plannedRoutes`) sind Absicht:
 *   Wegpunkte, die von Hand abgesteckt werden. Sie gehören dem Roadtrip, sind
 *   also auf allen Geräten der Crew da; welche davon aktiv ist, entscheidet
 *   jedes Gerät für sich. Unterwegs wird auf dem Kartentab nur noch die aktive
 *   Route gezeichnet und ihr Kartenraster geladen (siehe
 *   components/OfflineMapDownload).
 * * **Aufgezeichnete Fahrten** (`roadtrips/{tripId}/trackSessions`) sind
 *   Vergangenheit: alles zwischen „Tour starten" und „Tour stoppen", benannt
 *   beim Speichern (components/TrackSessionDialog.tsx). Änderbar ist an ihnen
 *   nur der Name – Start, Ende und Strecke sind Aufzeichnung, keine
 *   Beschriftung. Bis hierher gab es dafür überhaupt keine Stelle: Wer sich
 *   beim Speichern vertippt hatte, blieb darauf sitzen.
 *
 * Beide Listen benennen über denselben Dialog um (components/RouteEditDialog).
 */
export default function RoutePlanner() {
  const t = useT();
  const { locale } = useI18n();
  const { preferences } = usePreferences();
  const { notify } = useToast();
  const { tripId } = useRoadtrip();
  const planner = usePlannedRoutes();
  const { routes } = planner;
  const recordings = useTrackSessions();

  const [stakingId, setStakingId] = useState<string | null>(null);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());

  const staking = findRoute(routes, stakingId);
  const writeWaypoints = useCallback(
    (next: PlannedWaypoint[]) => {
      if (staking) planner.setWaypoints(staking, next);
    },
    [staking, planner]
  );
  const editor = useRouteEditor(staking?.waypoints ?? [], writeWaypoints);

  const baseLayer = getBaseLayer(preferences.baseLayer);
  // Beim Einhängen einmal gelesen (MapContainer wertet center/zoom nur initial
  // aus): am liebsten dort, wo die bearbeitete Route beginnt.
  const [fallbackView] = useState(readMapView);
  const start = staking?.waypoints[0];
  const center: [number, number] = start
    ? [start.lat, start.lng]
    : [fallbackView.lat, fallbackView.lng];

  // Strecke und Dauer einer Fahrt stehen nicht in ihrem Dokument, sondern in
  // den Punkten mit derselben Kennung – einmal gruppiert für alle Fahrten.
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const statsById = useMemo(() => sessionStatsById(track), [track]);

  const routeLabel = useCallback(
    (route: PlannedRoute) => route.name || t('plan.unnamed'),
    [t]
  );

  const dateLabel = useCallback(
    (iso: string) => {
      if (!iso) return t('plan.noDate');
      const parsed = new Date(`${iso}T00:00:00`);
      return Number.isNaN(parsed.getTime())
        ? iso
        : parsed.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    },
    [locale, t]
  );

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const route = planner.create(name, date);
    if (!route) return;
    setName('');
    setStakingId(route.id);
  };

  const handleDuplicate = (route: PlannedRoute) => {
    const copy = planner.duplicate(route, t('plan.copyName', { name: routeLabel(route) }));
    if (copy) setStakingId(copy.id);
  };

  // Gelöscht wird in den Papierkorb, nicht endgültig: Der Toast holt die
  // Route sofort zurück, der Papierkorb noch 30 Tage lang.
  const confirmDeleteRoute = async () => {
    const route = findRoute(routes, deleteRouteId);
    setDeleteRouteId(null);
    if (!route) return;
    if (stakingId === route.id) setStakingId(null);
    const removed = await planner.remove(route);
    if (!removed) {
      notify(t('plan.deleteFailed'), 'danger');
      return;
    }
    notify(t('plan.trashed'), 'success', {
      label: t('common.undo'),
      onAct: async () => {
        const back = await planner.restore(route.id);
        notify(back ? t('plan.restored') : t('common.restoreFailed'), back ? 'success' : 'danger');
      }
    });
  };

  const editingRoute = findRoute(routes, editRouteId);
  const findSession = (id: string | null) =>
    id ? (recordings.sessions.find((entry) => entry.id === id) ?? null) : null;
  const editingSession = findSession(editSessionId);
  const deletingSession = findSession(deleteSessionId);

  const handleRenameSession = async (session: TrackSession, value: string) => {
    setEditSessionId(null);
    const saved = await recordings.rename(session, value);
    notify(
      saved ? t('trackSession.renamed', { name: value.trim() }) : t('trackSession.renameFailed'),
      saved ? 'success' : 'danger'
    );
  };

  const confirmDeleteSession = async () => {
    const session = deletingSession;
    setDeleteSessionId(null);
    if (!session?.id) return;
    const sessionId = session.id;
    const removed = await recordings.remove(session);
    if (!removed) {
      notify(t('trackSession.deleteFailed'), 'danger');
      return;
    }
    notify(t('trackSession.trashed'), 'success', {
      label: t('common.undo'),
      onAct: async () => {
        const back = await recordings.restore(sessionId);
        notify(
          back ? t('trackSession.restored') : t('common.restoreFailed'),
          back ? 'success' : 'danger'
        );
      }
    });
  };

  /** Datum und Uhrzeit einer Fahrt – die Fahrt trägt ihren Tag im Start. */
  const sessionWhen = (session: TrackSession) => {
    const started = new Date(session.startedAt);
    return `${started.toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    })}, ${started.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="settings-page">
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />

      {staking && planner.canEdit && (
        <Section title={t('plan.editTitle', { name: routeLabel(staking) })}>
          <div className="stack">
            <p className="helper-text">{t('plan.intro')}</p>

            <MapContainer
              center={center}
              zoom={start ? 10 : fallbackView.zoom}
              className="route-planner-map"
              scrollWheelZoom
            >
              <OfflineTileLayer
                key={preferences.baseLayer}
                url={baseLayer.url}
                attribution={baseLayer.attribution}
                maxZoom={baseLayer.maxZoom}
                maxNativeZoom={baseLayer.maxNativeZoom}
              />
              <RouteEditorLayer
                active
                waypoints={editor.waypoints}
                onAdd={editor.addAt}
                onMove={editor.moveTo}
                onRemove={editor.remove}
              />
            </MapContainer>

            <div className="route-planner-stats">
              <span>{t('plan.points', { count: editor.waypoints.length })}</span>
              {editor.waypoints.length > 1 && (
                <span className="helper-text">
                  {formatDistance(editor.lengthMeters / 1000, preferences.unitSystem)}
                </span>
              )}
            </div>

            <div className="row">
              <Button
                variant="secondary"
                fullWidth
                onClick={editor.undo}
                disabled={editor.waypoints.length === 0}
              >
                <Undo2 size={16} /> {t('plan.undo')}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={editor.clear}
                disabled={editor.waypoints.length === 0}
              >
                <Trash2 size={16} /> {t('plan.clear')}
              </Button>
            </div>

            <Button fullWidth onClick={() => setStakingId(null)}>
              <Check size={16} /> {t('plan.done')}
            </Button>
          </div>
        </Section>
      )}

      <Section title={t('plan.planned')}>
        {routes.length === 0 ? (
          <EmptyState
            icon={<MapPin size={20} strokeWidth={1.75} />}
            title={t('plan.emptyTitle')}
            hint={t('plan.emptyHint')}
          />
        ) : (
          <div className="settings-list">
            {routes.map((route) => {
              const isActive = planner.activeId === route.id;
              return (
                <ListItem
                  key={route.id}
                  title={
                    <span className="route-planner-title">
                      {routeLabel(route)}
                      {isActive && <span className="route-planner-active">{t('plan.active')}</span>}
                    </span>
                  }
                  subtitle={`${dateLabel(route.date)} · ${t('plan.points', {
                    count: route.waypoints.length
                  })} · ${formatDistance(
                    plannedRouteLengthMeters(route.waypoints) / 1000,
                    preferences.unitSystem
                  )}`}
                  trailing={
                    <div className="route-planner-actions">
                      <IconButton
                        tone={isActive ? 'accent' : 'default'}
                        label={isActive ? t('plan.deactivate') : t('plan.activate')}
                        onClick={() => planner.setActive(isActive ? null : route.id)}
                      >
                        <Check size={18} />
                      </IconButton>
                      {planner.canEdit && (
                        <>
                          <IconButton
                            label={t('plan.rename')}
                            onClick={() => setEditRouteId(route.id)}
                          >
                            <Pencil size={18} />
                          </IconButton>
                          <IconButton
                            tone={stakingId === route.id ? 'accent' : 'default'}
                            label={t('plan.stake')}
                            onClick={() =>
                              setStakingId(stakingId === route.id ? null : route.id)
                            }
                          >
                            <Waypoints size={18} />
                          </IconButton>
                          <IconButton
                            label={t('plan.duplicate')}
                            onClick={() => handleDuplicate(route)}
                          >
                            <Copy size={18} />
                          </IconButton>
                          <IconButton
                            tone="danger"
                            label={t('plan.delete')}
                            onClick={() => setDeleteRouteId(route.id)}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}

        <p className="helper-text">{t('plan.downloadHint')}</p>
        <p className="helper-text">
          {planner.canEdit ? t('plan.sharedHint') : t('crew.readonlyHint')}
        </p>
      </Section>

      {planner.canEdit && (
        <Section title={t('plan.addTitle')}>
          <form className="stack" onSubmit={handleCreate}>
            <div className="row">
              <Input
                placeholder={t('plan.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button type="submit" fullWidth>
              <Plus size={16} /> {t('plan.add')}
            </Button>
          </form>
        </Section>
      )}

      <Section title={t('trackSession.listTitle')}>
        {recordings.sessions.length === 0 ? (
          <EmptyState
            icon={<RouteIcon size={20} strokeWidth={1.75} />}
            title={t('trackSession.emptyTitle')}
            hint={t('trackSession.emptyHint')}
          />
        ) : (
          <div className="settings-list">
            {recordings.sessions.map((session) => {
              const stats = statsById.get(session.id ?? '') ?? EMPTY_SESSION_STATS;
              return (
                <ListItem
                  key={session.id}
                  title={session.name}
                  subtitle={`${sessionWhen(session)} · ${formatDuration(
                    stats.durationMs
                  )} · ${formatDistance(stats.distanceKm, preferences.unitSystem)} · ${session.author}`}
                  trailing={
                    <div className="route-planner-actions">
                      {recordings.canEdit && (
                        <IconButton
                          label={t('trackSession.rename')}
                          onClick={() => setEditSessionId(session.id ?? null)}
                        >
                          <Pencil size={18} />
                        </IconButton>
                      )}
                      {recordings.canEdit && (
                        <IconButton
                          tone="danger"
                          label={t('trackSession.delete')}
                          onClick={() => setDeleteSessionId(session.id ?? null)}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}

        <p className="helper-text">{t('trackSession.listHint')}</p>
      </Section>

      {editingRoute && (
        <RouteEditDialog
          key={editingRoute.id}
          title={t('plan.renameTitle')}
          nameLabel={t('plan.nameLabel')}
          name={editingRoute.name}
          placeholder={t('plan.namePlaceholder')}
          date={editingRoute.date}
          dateLabel={t('plan.dateLabel')}
          requireName={false}
          onSave={({ name: value, date: day }) => {
            planner.rename(editingRoute, value, day);
            setEditRouteId(null);
          }}
          onCancel={() => setEditRouteId(null)}
        />
      )}

      {editingSession && (
        <RouteEditDialog
          key={editingSession.id}
          title={t('trackSession.renameTitle')}
          nameLabel={t('trackSession.nameLabel')}
          name={editingSession.name}
          maxLength={SESSION_NAME_MAX_LENGTH}
          onSave={({ name: value }) => handleRenameSession(editingSession, value)}
          onCancel={() => setEditSessionId(null)}
        />
      )}

      <ConfirmDialog
        open={deleteRouteId !== null}
        title={t('plan.deleteTitle')}
        description={t('plan.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDeleteRoute}
        onCancel={() => setDeleteRouteId(null)}
      />

      <ConfirmDialog
        open={deletingSession !== null}
        title={t('trackSession.deleteTitle')}
        description={t('trackSession.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDeleteSession}
        onCancel={() => setDeleteSessionId(null)}
      />
    </div>
  );
}
