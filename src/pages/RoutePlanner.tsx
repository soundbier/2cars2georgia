import { useCallback, useState } from 'react';
import { MapContainer } from 'react-leaflet';
import { Check, Copy, MapPin, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { OfflineTileLayer } from '../components/OfflineTileLayer';
import { RouteEditorLayer, useRouteEditor } from '../components/RoutePlanner';
import { usePlannedRoutes } from '../hooks/usePlannedRoutes';
import { usePreferences } from '../hooks/usePreferences';
import { getBaseLayer } from '../lib/mapLayers';
import { readMapView } from '../lib/mapView';
import { formatDistance } from '../lib/units';
import {
  findRoute,
  PlannedRoute,
  plannedRouteLengthMeters,
  PlannedWaypoint
} from '../lib/plannedRoute';
import { useI18n, useT } from '../i18n';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  ListItem,
  PageHeader,
  Section
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
 * Routenplaner: Tagesrouten anlegen, abstecken und für unterwegs auswählen.
 *
 * Erreichbar über das "Mehr"-Dropup neben Kombüse und Einstellungen – die
 * Planung passiert typischerweise vorher am großen Bildschirm, nicht während
 * der Fahrt. Die Routen gehören zum Roadtrip, sind also auf allen Geräten der
 * Crew da; welche davon aktiv ist, entscheidet jedes Gerät für sich. Unterwegs
 * wird auf dem Kartentab nur noch die aktive Route angezeigt und ihr
 * Kartenraster geladen (siehe components/OfflineMapDownload).
 */
export default function RoutePlanner() {
  const t = useT();
  const { locale } = useI18n();
  const { preferences } = usePreferences();
  const planner = usePlannedRoutes();
  const { routes } = planner;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());

  const editing = findRoute(routes, editingId);
  const writeWaypoints = useCallback(
    (next: PlannedWaypoint[]) => {
      if (editing) planner.setWaypoints(editing, next);
    },
    [editing, planner]
  );
  const editor = useRouteEditor(editing?.waypoints ?? [], writeWaypoints);

  const baseLayer = getBaseLayer(preferences.baseLayer);
  // Beim Einhängen einmal gelesen (MapContainer wertet center/zoom nur initial
  // aus): am liebsten dort, wo die bearbeitete Route beginnt.
  const [fallbackView] = useState(readMapView);
  const start = editing?.waypoints[0];
  const center: [number, number] = start
    ? [start.lat, start.lng]
    : [fallbackView.lat, fallbackView.lng];

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
    setEditingId(route.id);
  };

  const handleDuplicate = (route: PlannedRoute) => {
    const copy = planner.duplicate(route, t('plan.copyName', { name: routeLabel(route) }));
    if (copy) setEditingId(copy.id);
  };

  const confirmDelete = () => {
    const route = findRoute(routes, deleteId);
    if (route) {
      if (editingId === route.id) setEditingId(null);
      planner.remove(route);
    }
    setDeleteId(null);
  };

  return (
    <div className="settings-page">
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />

      {editing && planner.canEdit && (
        <Section title={t('plan.editTitle', { name: routeLabel(editing) })}>
          <div className="stack">
            <div className="row">
              <Input
                value={editing.name}
                placeholder={t('plan.namePlaceholder')}
                onChange={(e) => planner.rename(editing, e.target.value, editing.date)}
              />
              <Input
                type="date"
                value={editing.date}
                onChange={(e) => planner.rename(editing, editing.name, e.target.value)}
              />
            </div>

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

            <Button fullWidth onClick={() => setEditingId(null)}>
              <Check size={16} /> {t('plan.done')}
            </Button>
          </div>
        </Section>
      )}

      <Section title={t('plan.routes')}>
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
                            label={t('plan.edit')}
                            onClick={() => setEditingId(editingId === route.id ? null : route.id)}
                          >
                            <Pencil size={18} />
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
                            onClick={() => setDeleteId(route.id)}
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

      <ConfirmDialog
        open={deleteId !== null}
        title={t('plan.deleteTitle')}
        description={t('plan.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
