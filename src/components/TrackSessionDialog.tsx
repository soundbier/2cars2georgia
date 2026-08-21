import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { FinishedSession } from '../hooks/useTracking';
import { usePreferences } from '../hooks/usePreferences';
import { trackWrite } from '../lib/pendingWrites';
import {
  pointsOfSession,
  sessionStartParts,
  trackSessionStats,
  SESSION_NAME_MAX_LENGTH
} from '../lib/trackSession';
import { formatDuration } from '../lib/tripStats';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { GpsPoint, TrackSession } from '../types';
import { useI18n, useT } from '../i18n';
import { Button, Input, useToast } from './ui';
import './TrackSessionDialog.css';

interface TrackSessionDialogProps {
  /** Die gerade beendete Aufzeichnung, oder null solange keine wartet. */
  session: FinishedSession | null;
  /** Alle Trackpunkte des Roadtrips – gefiltert wird hier. */
  points: GpsPoint[];
  /** Anzeigename der aufzeichnenden Person, wie an den Trackpunkten. */
  author: string;
  onClose: () => void;
}

/**
 * Speichern-Fenster nach dem Stoppen einer Tour.
 *
 * Die Punkte sind zu diesem Zeitpunkt längst geschrieben – hier entscheidet
 * sich nur, ob die Aufzeichnung einen Namen bekommt, unter dem sie später
 * wiederzufinden ist. Deshalb gibt es kein „Abbrechen": Schließen ohne Namen
 * verwirft nichts, es lässt die Fahrt nur namenlos in der Gesamtspur stehen.
 */
export function TrackSessionDialog({ session, points, author, onClose }: TrackSessionDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const { tripId, authUser } = useRoadtrip();
  const { preferences } = usePreferences();
  const { locale } = useI18n();
  const { notify } = useToast();
  const t = useT();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const start = session ? sessionStartParts(session.startedAt, locale) : null;

  // Der Vorschlag steht erst fest, wenn die Aufzeichnung endet – vorher gibt
  // es keinen Startzeitpunkt, auf den er sich beziehen könnte.
  useEffect(() => {
    if (!session || !start) return;
    setName(t('trackSession.defaultName', { date: start.date, time: start.time }));
    setSaving(false);
    // Absichtlich nur an der Aufzeichnung selbst: Ein bereits geänderter Name
    // soll nicht bei jedem Rendern wieder auf den Vorschlag zurückspringen.
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, onClose]);

  const stats = useMemo(
    () => trackSessionStats(session ? pointsOfSession(points, session.id) : []),
    [points, session]
  );

  if (!session || !start) return null;

  const trimmed = name.trim();
  const recorded = stats.pointCount > 0;

  const handleSave = async () => {
    if (!tripId || !trimmed || saving) return;
    setSaving(true);
    const entry: TrackSession = {
      name: trimmed.slice(0, SESSION_NAME_MAX_LENGTH),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      author,
      ...(authUser?.uid ? { authorId: authUser.uid } : {})
    };
    try {
      await trackWrite(setDoc(doc(db, tripPath(tripId, 'trackSessions'), session.id), entry));
      notify(t('trackSession.saved', { name: entry.name }), 'success');
      onClose();
    } catch (err) {
      console.error('Aufzeichnung konnte nicht gespeichert werden:', err);
      notify(t('trackSession.saveFailed'), 'danger');
      setSaving(false);
    }
  };

  const distance = `${toDisplayDistance(stats.distanceKm, preferences.unitSystem).toFixed(1)} ${distanceUnitLabel(preferences.unitSystem)}`;

  return createPortal(
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog track-session-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog-title">
          {t('trackSession.title')}
        </h2>
        <p className="dialog-description">
          {recorded ? t('trackSession.description') : t('trackSession.emptyDescription')}
        </p>

        <dl className="track-session-summary">
          <div>
            <dt className="label">{t('trackSession.startedAt')}</dt>
            <dd>{t('trackSession.defaultName', { date: start.date, time: start.time })}</dd>
          </div>
          <div>
            <dt className="label">{t('logbook.duration')}</dt>
            <dd>{formatDuration(stats.durationMs)}</dd>
          </div>
          <div>
            <dt className="label">{t('logbook.distance')}</dt>
            <dd>{distance}</dd>
          </div>
          <div>
            <dt className="label">{t('trackSession.points')}</dt>
            <dd>{stats.pointCount}</dd>
          </div>
        </dl>

        {recorded && (
          <div className="track-session-field">
            <label className="label" htmlFor={nameId}>
              {t('trackSession.nameLabel')}
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={SESSION_NAME_MAX_LENGTH}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div className="dialog-actions">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {recorded ? t('trackSession.skip') : t('common.close')}
          </Button>
          {recorded && (
            <Button variant="primary" fullWidth disabled={!trimmed || saving} onClick={handleSave}>
              {t('common.save')}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
