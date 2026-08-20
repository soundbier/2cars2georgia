import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Navigation, Clock, User, BookOpen, Pencil, Trash2, Check, X, Image } from 'lucide-react';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { usePermissions } from '../hooks/usePermissions';
import { useSoftDelete } from '../hooks/useSoftDelete';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { formatDuration, totalDistanceKm, trackDurationMs } from '../lib/tripStats';
import { groupByDay, mostRecentDay } from '../lib/dayRecap';
import { activeOnly } from '../lib/trash';
import { useI18n, useT } from '../i18n';
import { LogEvent, GpsPoint, LogType, QuickLogConfig } from '../types';
import { PageHeader, EmptyState, IconButton, Input, Select, ConfirmDialog, Button, useToast } from '../components/ui';
import { DayRecapDialog } from '../components/DayRecapDialog';
import './Stats.css';

type EventChanges = Pick<LogEvent, 'title' | 'type'>;

interface LogbookEntryProps {
  event: LogEvent;
  quickLogs: QuickLogConfig[];
  canEdit: boolean;
  onSave: (id: string, changes: EventChanges) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
}

function LogbookEntry({ event, quickLogs, canEdit, onSave, onRequestDelete }: LogbookEntryProps) {
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
          canEdit && (
            <>
              <IconButton label={t('logbook.editEvent')} onClick={startEditing}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label={t('logbook.deleteEvent')} tone="danger" onClick={() => onRequestDelete(event.id!)}>
                <Trash2 size={16} />
              </IconButton>
            </>
          )
        )}
      </div>
    </div>
  );
}

export default function Stats({ user }: { user: string }) {
  const { tripId, tripName } = useRoadtrip();
  const { canEdit } = usePermissions(user);
  const quickLogs = useQuickLogs();
  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'desc');
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const { preferences } = usePreferences();
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'events',
    'logbook.eventTrashed',
    'logbook.eventRestored'
  );
  const { notify } = useToast();
  const t = useT();
  const [recapOpen, setRecapOpen] = useState(false);

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

  // Nach Kalendertag gruppiert für die teilbare Tagesübersicht (siehe
  // components/DayRecapDialog) – unabhängig von der Papierkorb-Filterung
  // oben, damit ein gelöschtes Ereignis auch dort nicht mehr auftaucht.
  const days = useMemo(() => groupByDay(track, events), [track, events]);
  const defaultDay = useMemo(() => mostRecentDay(days), [days]);

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

      {/* Immer sichtbar, auch ohne Track/Ereignisse – der Dialog selbst zeigt
          dann einen Leer-Hinweis statt einer Vorschau. So verschwindet der
          Einstieg für die Instagram-Tagesübersicht nie aus dem Logbuch. */}
      <Button variant="secondary" fullWidth onClick={() => setRecapOpen(true)} className="logbook-recap-button">
        <Image size={18} /> {t('dayRecap.openButton')}
      </Button>

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
              canEdit={canEdit}
              onSave={handleSaveEdit}
              onRequestDelete={requestDelete}
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
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <DayRecapDialog
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        tripName={tripName ?? t('export.defaultTripName')}
        days={days}
        initialDayKey={defaultDay?.key ?? null}
      />
    </div>
  );
}
