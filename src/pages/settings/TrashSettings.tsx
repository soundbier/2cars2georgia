import { useMemo, useState } from 'react';
import { deleteDoc, deleteField, doc, updateDoc } from 'firebase/firestore';
import {
  RotateCcw,
  Trash2,
  Bath,
  BookOpen,
  Wallet,
  ShieldCheck,
  UtensilsCrossed,
  CalendarDays,
  Package,
  ShoppingCart,
  Route as RouteIcon,
  Waypoints
} from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useQuickLogs } from '../../hooks/useSettings';
import { writeOptimistically } from '../../lib/writeOutcome';
import { activeOnly, deletedOnly, isExpired, retentionDaysLeft, TRASH_RETENTION_MS } from '../../lib/trash';
import { plannedRouteLengthMeters, routeFromDoc } from '../../lib/plannedRoute';
import { placeLabelKey, TOILET_DETAILS, TOILET_STOPS } from '../../lib/toiletStops';
import { formatDistance } from '../../lib/units';
import { usePreferences } from '../../hooks/usePreferences';
import { useI18n, useT } from '../../i18n';
import {
  Dish,
  Expense,
  InventoryItem,
  LogEvent,
  MealPlanEntry,
  ShoppingListExtra,
  ToiletStop,
  TrackSession
} from '../../types';
import {
  Button,
  Section,
  ListItem,
  EmptyState,
  IconButton,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';

const RETENTION_DAYS = Math.round(TRASH_RETENTION_MS / (24 * 60 * 60 * 1000));

type TrashCollection =
  | 'events'
  | 'expenses'
  | 'dishes'
  | 'mealPlanEntries'
  | 'inventory'
  | 'shoppingListExtras'
  | 'plannedRoutes'
  | 'trackSessions'
  | 'toiletStops';

/** Wie eine geplante Route aus Firestore hereinkommt (siehe lib/plannedRoute.ts). */
type PlannedRouteDoc = Record<string, unknown> & { id: string };

const ICON_BY_COLLECTION: Record<TrashCollection, typeof BookOpen> = {
  events: BookOpen,
  expenses: Wallet,
  dishes: UtensilsCrossed,
  mealPlanEntries: CalendarDays,
  inventory: Package,
  shoppingListExtras: ShoppingCart,
  plannedRoutes: Waypoints,
  trackSessions: RouteIcon,
  toiletStops: Bath
};

interface TrashItem {
  id: string;
  collectionName: TrashCollection;
  title: string;
  subtitle: string;
  deletedAt: number;
}

/** Was der Papierkorb löschen soll: einen einzelnen Eintrag oder alles. */
type PurgeTarget = { kind: 'item'; item: TrashItem } | { kind: 'all' };

export default function TrashSettings({ currentUser }: { currentUser: string }) {
  const { tripId, isAdmin } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const { notify } = useToast();
  const { locale } = useI18n();
  const t = useT();
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const events = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'desc');
  const expenses = useCollection<Expense>(tripId ? tripPath(tripId, 'expenses') : null, 'timestamp', 'desc');
  const dishes = useCollection<Dish>(tripId ? tripPath(tripId, 'dishes') : null, 'timestamp', 'desc');
  const mealPlanEntries = useCollection<MealPlanEntry>(
    tripId ? tripPath(tripId, 'mealPlanEntries') : null,
    'timestamp',
    'desc'
  );
  const inventory = useCollection<InventoryItem>(tripId ? tripPath(tripId, 'inventory') : null, 'timestamp', 'desc');
  const shoppingListExtras = useCollection<ShoppingListExtra>(
    tripId ? tripPath(tripId, 'shoppingListExtras') : null,
    'timestamp',
    'desc'
  );

  const plannedRoutes = useCollection<PlannedRouteDoc>(
    tripId ? tripPath(tripId, 'plannedRoutes') : null,
    'updatedAt',
    'desc'
  );
  const trackSessions = useCollection<TrackSession>(
    tripId ? tripPath(tripId, 'trackSessions') : null,
    'startedAt',
    'desc'
  );
  // Nur die Marker – die private Beschreibung dazu liest der Papierkorb gar
  // nicht erst (siehe lib/toiletStops.ts); sie hängt still an ihrer Id und
  // geht beim endgültigen Löschen mit.
  const toiletStops = useCollection<ToiletStop>(
    tripId ? tripPath(tripId, TOILET_STOPS) : null,
    'timestamp',
    'desc'
  );

  const items = useMemo<TrashItem[]>(() => {
    const labelByType = new Map(quickLogs.map((q) => [q.id, q.label]));
    // Für Speiseplan-Einträge im Papierkorb: der Gerichtname, nicht die id.
    // Nachschlagen nur unter den noch aktiven Gerichten – ist das Gericht
    // selbst gelöscht, bleibt die id als Fallback stehen.
    const dishNameById = new Map(activeOnly(dishes).map((dish) => [dish.id!, dish.name]));

    const deletedEvents = deletedOnly(events).map<TrashItem>((event) => ({
      id: event.id!,
      collectionName: 'events',
      title: event.title,
      subtitle: `${labelByType.get(event.type) ?? event.type} · ${event.author}`,
      deletedAt: event.deletedAt!
    }));

    const deletedExpenses = deletedOnly(expenses).map<TrashItem>((expense) => ({
      id: expense.id!,
      collectionName: 'expenses',
      title: expense.title,
      subtitle: `${expense.amountEuro.toFixed(2)} € · ${expense.paidBy}`,
      deletedAt: expense.deletedAt!
    }));

    const deletedDishes = deletedOnly(dishes).map<TrashItem>((dish) => ({
      id: dish.id!,
      collectionName: 'dishes',
      title: dish.name,
      subtitle: t(`mealType.${dish.mealType}`),
      deletedAt: dish.deletedAt!
    }));

    const deletedMealPlanEntries = deletedOnly(mealPlanEntries).map<TrashItem>((entry) => ({
      id: entry.id!,
      collectionName: 'mealPlanEntries',
      title: dishNameById.get(entry.dishId) ?? entry.dishId,
      subtitle: `${entry.date} · ${t(`mealType.${entry.mealType}`)}`,
      deletedAt: entry.deletedAt!
    }));

    const deletedInventory = deletedOnly(inventory).map<TrashItem>((item) => ({
      id: item.id!,
      collectionName: 'inventory',
      title: item.name,
      subtitle: `${item.quantity} ${item.unit} · ${item.location}`,
      deletedAt: item.deletedAt!
    }));

    const deletedExtras = deletedOnly(shoppingListExtras).map<TrashItem>((extra) => ({
      id: extra.id!,
      collectionName: 'shoppingListExtras',
      title: extra.name,
      subtitle: `${extra.quantity} ${extra.unit}`,
      deletedAt: extra.deletedAt!
    }));

    // Geplante Routen tragen ihren Namen selten – dann sagt die Länge mehr
    // als „Ohne Namen" allein.
    const deletedRoutes = deletedOnly(
      plannedRoutes.map((entry) => routeFromDoc(entry.id, entry))
    ).map<TrashItem>((route) => ({
      id: route.id,
      collectionName: 'plannedRoutes',
      title: route.name || t('plan.unnamed'),
      subtitle: `${t('plan.points', { count: route.waypoints.length })} · ${formatDistance(
        plannedRouteLengthMeters(route.waypoints) / 1000,
        preferences.unitSystem
      )}`,
      deletedAt: route.deletedAt!
    }));

    // Die Trackpunkte der Fahrt bleiben auf der Karte, gelöscht ist nur ihr
    // Name – deshalb hier bewusst ohne Strecke, die ist nicht weg.
    const deletedSessions = deletedOnly(trackSessions).map<TrashItem>((session) => ({
      id: session.id!,
      collectionName: 'trackSessions',
      title: session.name,
      subtitle: `${new Date(session.startedAt).toLocaleDateString(locale)} · ${session.author}`,
      deletedAt: session.deletedAt!
    }));

    const deletedToiletStops = deletedOnly(toiletStops).map<TrashItem>((stop) => ({
      id: stop.id!,
      collectionName: 'toiletStops',
      title: t(placeLabelKey(stop.placeType)),
      subtitle: `${new Date(stop.timestamp).toLocaleDateString(locale)} · ${stop.author}`,
      deletedAt: stop.deletedAt!
    }));

    return [
      ...deletedEvents,
      ...deletedExpenses,
      ...deletedDishes,
      ...deletedMealPlanEntries,
      ...deletedInventory,
      ...deletedExtras,
      ...deletedRoutes,
      ...deletedSessions,
      ...deletedToiletStops
    ].sort((a, b) => b.deletedAt - a.deletedAt);
  }, [
    events,
    expenses,
    dishes,
    mealPlanEntries,
    inventory,
    shoppingListExtras,
    plannedRoutes,
    trackSessions,
    toiletStops,
    preferences.unitSystem,
    locale,
    quickLogs,
    t
  ]);

  const expiredCount = useMemo(() => items.filter((item) => isExpired(item)).length, [items]);

  const restore = (item: TrashItem) => {
    if (!tripId || !canEdit) return;
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, item.collectionName), item.id), { deletedAt: deleteField() }),
      () => notify(t('trash.restoreFailed'), 'danger')
    );
    notify(t('trash.restored'), 'success');
  };

  const confirmPurge = () => {
    const target = purgeTarget;
    setPurgeTarget(null);
    if (!target || !tripId || !canEdit || !isAdmin) return;

    const toPurge = target.kind === 'all' ? items : [target.item];
    // Bewusst einzeln statt als Batch: Die Schreibvorgänge laufen auch offline
    // über den Firestore-Cache und sollen einzeln nachziehen können. Auf die
    // Server-Bestätigung wird nicht gewartet, siehe lib/writeOutcome.ts.
    let reported = false;
    const fail = () => {
      if (reported) return;
      reported = true;
      notify(t('trash.purgeFailed'), 'danger');
    };
    for (const item of toPurge) {
      writeOptimistically(deleteDoc(doc(db, tripPath(tripId, item.collectionName), item.id)), fail);
      // Firestore löscht nichts kaskadierend: Die Beschreibung eines
      // Toilettenstopps liegt unter derselben Id in einer eigenen Collection
      // und bliebe sonst als Waise zurück.
      if (item.collectionName === 'toiletStops') {
        writeOptimistically(deleteDoc(doc(db, tripPath(tripId, TOILET_DETAILS), item.id)), fail);
      }
    }
    notify(
      toPurge.length === 1 ? t('trash.purgedOne') : t('trash.purgedMany', { count: toPurge.length }),
      'success'
    );
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('trash.title')}
        subtitle={t('trash.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      <Section title={t('trash.section', { count: items.length })}>
        {items.length === 0 ? (
          <EmptyState
            icon={<Trash2 size={26} strokeWidth={1.5} />}
            title={t('trash.empty')}
            hint={t('trash.emptyHint', { count: RETENTION_DAYS })}
          />
        ) : (
          <div className="settings-list">
            {items.map((item) => {
              const daysLeft = retentionDaysLeft(item);
              const Icon = ICON_BY_COLLECTION[item.collectionName];
              return (
                <ListItem
                  key={`${item.collectionName}-${item.id}`}
                  leading={<Icon size={18} strokeWidth={1.75} color="var(--color-accent)" />}
                  title={item.title}
                  subtitle={`${item.subtitle} · ${
                    daysLeft > 0 ? t('trash.daysLeft', { count: daysLeft }) : t('trash.expired')
                  }`}
                  trailing={
                    canEdit ? (
                      <>
                        <IconButton
                          label={t('trash.restore', { title: item.title })}
                          tone="accent"
                          onClick={() => restore(item)}
                        >
                          <RotateCcw size={16} />
                        </IconButton>
                        {isAdmin && (
                          <IconButton
                            label={t('trash.purgeOne', { title: item.title })}
                            tone="danger"
                            onClick={() => setPurgeTarget({ kind: 'item', item })}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      {items.length > 0 && (
        <Section title={t('trash.cleanupSection')}>
          <p className="helper-text setting-note">
            {expiredCount > 0
              ? t('trash.expiredNote', { count: expiredCount, days: RETENTION_DAYS })
              : t('trash.retentionNote', { days: RETENTION_DAYS })}
          </p>
          {/* Endgültiges Löschen ist adminpflichtig (firestore.rules): ohne
              Admin-Modus lehnt der Server es ohnehin ab. */}
          {canEdit &&
            (isAdmin ? (
              <Button variant="destructive" fullWidth onClick={() => setPurgeTarget({ kind: 'all' })}>
                <Trash2 size={18} /> {t('trash.emptyTrashButton')}
              </Button>
            ) : (
              <p className="helper-text setting-note">
                <ShieldCheck size={13} className="setting-note-icon" />
                {t('admin.requiredForPurge')}
              </p>
            ))}
        </Section>
      )}

      <ConfirmDialog
        open={purgeTarget !== null}
        title={purgeTarget?.kind === 'all' ? t('trash.purgeAllTitle') : t('trash.purgeOneTitle')}
        description={
          purgeTarget?.kind === 'all'
            ? t('trash.purgeAllDescription', { count: items.length })
            : t('trash.purgeOneDescription', { title: purgeTarget?.item.title ?? '' })
        }
        confirmLabel={t('trash.purgeOneTitle')}
        destructive
        onConfirm={confirmPurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </div>
  );
}
