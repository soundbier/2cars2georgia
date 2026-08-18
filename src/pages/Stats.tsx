import { useMemo, useState } from 'react';
import { doc, deleteField, updateDoc } from 'firebase/firestore';
import { Navigation, Clock, User, BookOpen, Pencil, Trash2, Check, X } from 'lucide-react';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { trackWrite } from '../lib/pendingWrites';
import { writeOptimistically } from '../lib/writeOutcome';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { formatDuration, totalDistanceKm, trackDurationMs } from '../lib/tripStats';
import { activeOnly } from '../lib/trash';
import { useI18n, useT } from '../i18n';
import { LogEvent, GpsPoint, LogType, QuickLogConfig } from '../types';
import { PageHeader, EmptyState, IconButton, Input, Select, ConfirmDialog, useToast } from '../components/ui';
import './Stats.css';

type EventChanges = Pick<LogEvent, 'title' | 'type'>;

interface LogbookEntryProps {
  event: LogEvent;
  quickLogs: QuickLogConfig[];
  onSave: (id: string, changes: EventChanges) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
}

function LogbookEntry({ event, quickLogs, onSave, onRequestDelete }: LogbookEntryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<LogType>(event.type);
  const { notify } = useToast();
  const { locale } = useI18n();
  const t = useT();
  const timestamp = new Date(event.timestamp);
  const Icon = getQuickLogIcon(quickLogs.find((q) => q.id === event.type)?.iconName);

  const startEditing = () => {
    setTitle(event.title);
    setType(event.type);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      notify(t('logbook.titleRequired'), 'danger');
      return;
    }
    const saved = await onSave(event.id!, { title: trimmedTitle, type });
    if (saved) setIsEditing(false);
  };

  return (
    <div className="logbook-entry">
      <div className="logbook-entry-time">
        <span className="logbook-entry-time-row">
          <Icon size={14} strokeWidth={1.75} color="var(--color-accent)" />
          <span className="mono-num">
            {timestamp.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        <span className="helper-text">{timestamp.toLocaleDateString(locale)}</span>
      </div>

      <div className="logbook-entry-body">
        {isEditing ? (
          <div className="stack logbook-entry-edit">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('logbook.titlePlaceholder')}
            />
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {quickLogs.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
              {/* Legacy-/gelöschte Kategorie: aktuellen Wert trotzdem anzeigen */}
              {!quickLogs.some((q) => q.id === type) && <option value={type}>{type}</option>}
            </Select>
          </div>
        ) : (
          <>
            <div className="logbook-entry-title">{event.title}</div>
            <div className="row helper-text">
              <User size={13} />
              <span>{event.author}</span>
            </div>
          </>
        )}
      </div>

      <div className="logbook-entry-actions">
        {isEditing ? (
          <>
            <IconButton label={t('common.save')} tone="accent" onClick={handleSave} disabled={!title.trim()}>
              <Check size={16} />
            </IconButton>
            <IconButton label={t('common.cancel')} onClick={() => setIsEditing(false)}>
              <X size={16} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton label={t('logbook.editEvent')} onClick={startEditing}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label={t('logbook.deleteEvent')} tone="danger" onClick={() => onRequestDelete(event.id!)}>
              <Trash2 size={16} />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}

export default function Stats() {
  const { tripId } = useRoadtrip();
  const quickLogs = useQuickLogs();
  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'desc');
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const { preferences } = usePreferences();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { notify } = useToast();
  const t = useT();

  // Einträge im Papierkorb bleiben in Firestore, verschwinden aber aus dem
  // Logbuch – wiederherstellbar über Einstellungen → Papierkorb.
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);

  const { distance, duration } = useMemo(
    () => ({
      distance: toDisplayDistance(totalDistanceKm(track), preferences.unitSystem).toFixed(1),
      duration: formatDuration(trackDurationMs(track))
    }),
    [track, preferences.unitSystem]
  );

  const handleSaveEdit = async (id: string, changes: EventChanges) => {
    if (!tripId) return false;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'events'), id), changes));
      notify(t('logbook.eventUpdated'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
      return false;
    }
  };

  const restoreEvent = (id: string) => {
    if (!tripId) return;
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, 'events'), id), { deletedAt: deleteField() }),
      () => notify(t('common.restoreFailed'), 'danger')
    );
    notify(t('logbook.eventRestored'), 'success');
  };

  const handleDeleteEvent = () => {
    if (!deleteTargetId || !tripId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, 'events'), id), { deletedAt: Date.now() }),
      () => notify(t('common.deleteError'), 'danger')
    );
    notify(t('logbook.eventTrashed'), 'success', {
      label: t('common.undo'),
      onAct: () => restoreEvent(id)
    });
  };

  return (
    <div>
      <PageHeader title={t('logbook.title')} subtitle={t('logbook.subtitle')} />

      <div className="logbook-summary">
        <div className="logbook-summary-item">
          <Navigation size={16} strokeWidth={1.75} />
          <div>
            <div className="mono-num logbook-summary-value">
              {distance} {distanceUnitLabel(preferences.unitSystem)}
            </div>
            <div className="label">{t('logbook.distance')}</div>
          </div>
        </div>
        <div className="logbook-summary-divider" />
        <div className="logbook-summary-item">
          <Clock size={16} strokeWidth={1.75} />
          <div>
            <div className="mono-num logbook-summary-value">{duration}</div>
            <div className="label">{t('logbook.duration')}</div>
          </div>
        </div>
      </div>

      <h2 className="section-title section-title-spaced">
        {t('logbook.events', { count: events.length })}
      </h2>

      {events.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} strokeWidth={1.5} />}
          title={t('logbook.empty')}
          hint={t('logbook.emptyHint')}
        />
      ) : (
        <div className="logbook-entries">
          {events.map((evt) => (
            <LogbookEntry
              key={evt.id}
              event={evt}
              quickLogs={quickLogs}
              onSave={handleSaveEdit}
              onRequestDelete={setDeleteTargetId}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('logbook.deleteTitle')}
        description={t('logbook.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
