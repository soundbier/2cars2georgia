import { useMemo, useState } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Navigation, Clock, User, BookOpen, Pencil, Trash2, Check, X } from 'lucide-react';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { distanceMeters } from '../lib/geo';
import { LogEvent, GpsPoint, LogType, QuickLogConfig } from '../types';
import { PageHeader, EmptyState, IconButton, Input, Select, ConfirmDialog, useToast } from '../components/ui';
import './Stats.css';

/** Gesamtstrecke entlang der Trackpunkte in Kilometern. */
function totalDistanceKm(points: GpsPoint[]): number {
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += distanceMeters(points[i - 1], points[i]);
  }
  return totalMeters / 1000;
}

function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

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
      notify('Titel darf nicht leer sein.', 'danger');
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
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        <span className="helper-text">{timestamp.toLocaleDateString()}</span>
      </div>

      <div className="logbook-entry-body">
        {isEditing ? (
          <div className="stack logbook-entry-edit">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel"
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
            <IconButton label="Speichern" tone="accent" onClick={handleSave} disabled={!title.trim()}>
              <Check size={16} />
            </IconButton>
            <IconButton label="Abbrechen" onClick={() => setIsEditing(false)}>
              <X size={16} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton label="Ereignis bearbeiten" onClick={startEditing}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label="Ereignis löschen" tone="danger" onClick={() => onRequestDelete(event.id!)}>
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
  const events = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'desc');
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);
  const { preferences } = usePreferences();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { notify } = useToast();

  const { distance, duration } = useMemo(
    () => ({
      distance: toDisplayDistance(totalDistanceKm(track), preferences.unitSystem).toFixed(1),
      duration: formatDuration(
        track.length > 1 ? track[track.length - 1].timestamp - track[0].timestamp : 0
      )
    }),
    [track, preferences.unitSystem]
  );

  const handleSaveEdit = async (id: string, changes: EventChanges) => {
    if (!tripId) return false;
    try {
      await updateDoc(doc(db, tripPath(tripId, 'events'), id), changes);
      notify('Ereignis aktualisiert', 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
      return false;
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTargetId || !tripId) return;
    try {
      await deleteDoc(doc(db, tripPath(tripId, 'events'), deleteTargetId));
      notify('Ereignis gelöscht', 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Löschen.', 'danger');
    }
    setDeleteTargetId(null);
  };

  return (
    <div>
      <PageHeader title="Logbuch" subtitle="Strecke, Dauer und Ereignisse der Reise" />

      <div className="logbook-summary">
        <div className="logbook-summary-item">
          <Navigation size={16} strokeWidth={1.75} />
          <div>
            <div className="mono-num logbook-summary-value">
              {distance} {distanceUnitLabel(preferences.unitSystem)}
            </div>
            <div className="label">Strecke</div>
          </div>
        </div>
        <div className="logbook-summary-divider" />
        <div className="logbook-summary-item">
          <Clock size={16} strokeWidth={1.75} />
          <div>
            <div className="mono-num logbook-summary-value">{duration}</div>
            <div className="label">Dauer</div>
          </div>
        </div>
      </div>

      <h2 className="section-title section-title-spaced">Ereignisse ({events.length})</h2>

      {events.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} strokeWidth={1.5} />}
          title="Noch keine Einträge"
          hint="Ereignisse über die Schnell-Logs im Cockpit erfassen."
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
        title="Ereignis löschen"
        description="Dieser Log-Eintrag wird endgültig entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
