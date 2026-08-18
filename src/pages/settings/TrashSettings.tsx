import { useMemo, useState } from 'react';
import { deleteDoc, deleteField, doc, updateDoc } from 'firebase/firestore';
import { RotateCcw, Trash2, BookOpen, Wallet } from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useQuickLogs } from '../../hooks/useSettings';
import { writeOptimistically } from '../../lib/writeOutcome';
import { deletedOnly, isExpired, retentionDaysLeft, TRASH_RETENTION_MS } from '../../lib/trash';
import { useT } from '../../i18n';
import { Expense, LogEvent } from '../../types';
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

type TrashCollection = 'events' | 'expenses';

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
  const { tripId } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const quickLogs = useQuickLogs();
  const { notify } = useToast();
  const t = useT();
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const events = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'desc');
  const expenses = useCollection<Expense>(tripId ? tripPath(tripId, 'expenses') : null, 'timestamp', 'desc');

  const items = useMemo<TrashItem[]>(() => {
    const labelByType = new Map(quickLogs.map((q) => [q.id, q.label]));

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

    return [...deletedEvents, ...deletedExpenses].sort((a, b) => b.deletedAt - a.deletedAt);
  }, [events, expenses, quickLogs]);

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
    if (!target || !tripId || !canEdit) return;

    const toPurge = target.kind === 'all' ? items : [target.item];
    // Bewusst einzeln statt als Batch: Die Schreibvorgänge laufen auch offline
    // über den Firestore-Cache und sollen einzeln nachziehen können. Auf die
    // Server-Bestätigung wird nicht gewartet, siehe lib/writeOutcome.ts.
    let reported = false;
    for (const item of toPurge) {
      writeOptimistically(deleteDoc(doc(db, tripPath(tripId, item.collectionName), item.id)), () => {
        if (reported) return;
        reported = true;
        notify(t('trash.purgeFailed'), 'danger');
      });
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
              return (
                <ListItem
                  key={`${item.collectionName}-${item.id}`}
                  leading={
                    item.collectionName === 'events' ? (
                      <BookOpen size={18} strokeWidth={1.75} color="var(--color-accent)" />
                    ) : (
                      <Wallet size={18} strokeWidth={1.75} color="var(--color-accent)" />
                    )
                  }
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
                        <IconButton
                          label={t('trash.purgeOne', { title: item.title })}
                          tone="danger"
                          onClick={() => setPurgeTarget({ kind: 'item', item })}
                        >
                          <Trash2 size={16} />
                        </IconButton>
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
          {canEdit && (
            <Button variant="destructive" fullWidth onClick={() => setPurgeTarget({ kind: 'all' })}>
              <Trash2 size={18} /> {t('trash.emptyTrashButton')}
            </Button>
          )}
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
