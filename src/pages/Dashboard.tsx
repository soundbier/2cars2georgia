import { useMemo, useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Play, Pause, Square, Satellite, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../firebase';
import { useTracking } from '../hooks/useTracking';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { useCollection } from '../hooks/useCollection';
import { usePermissions } from '../hooks/usePermissions';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { activeOnly } from '../lib/trash';
import { formatDuration, totalDistanceKm, trackDurationMs } from '../lib/tripStats';
import {
  distanceUnitLabel,
  speedUnitLabel,
  toDisplayDistance,
  toDisplaySpeed
} from '../lib/units';
import { GpsPoint, LogType, LogEvent } from '../types';
import { useT } from '../i18n';
import { Button, EmptyState, useToast } from '../components/ui';
import './Dashboard.css';

/**
 * Wie viele Schnell-Logs ohne Aufklappen sichtbar sind.
 *
 * Drei große Kacheln statt einer Matrix aus neun gleich gewichteten Knöpfen:
 * Was oben in den Einstellungen steht, ist das, was unterwegs am häufigsten
 * gebraucht wird – der Rest bleibt einen Tipp entfernt.
 */
const VISIBLE_QUICK_LOGS = 3;

/** Wie viele Einträge des Tages im Cockpit stehen, bevor das Logbuch dran ist. */
const TODAY_PREVIEW_COUNT = 4;

function isToday(timestamp: number): boolean {
  const now = new Date();
  const then = new Date(timestamp);
  return (
    then.getDate() === now.getDate() &&
    then.getMonth() === now.getMonth() &&
    then.getFullYear() === now.getFullYear()
  );
}

export default function Dashboard({ user }: { user: string }) {
  const { position, error, isTracking, setIsTracking, isPaused, setIsPaused } = useTracking();
  const { tripId, tripName } = useRoadtrip();
  const { canEdit } = usePermissions(user);
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const [isLogging, setIsLogging] = useState(false);
  const [showAllQuickLogs, setShowAllQuickLogs] = useState(false);
  const { notify } = useToast();
  const t = useT();

  // Dieselben Abos wie im Logbuch – die Werte im Instrument sind die Zahlen,
  // die dort ausführlich stehen, hier nur als laufende Anzeige.
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null, 'timestamp', 'asc');
  const allEvents = useCollection<LogEvent>(
    tripId ? tripPath(tripId, 'events') : null,
    'timestamp',
    'desc'
  );

  const todaysEvents = useMemo(
    () => activeOnly(allEvents).filter((event) => isToday(event.timestamp)),
    [allEvents]
  );

  const { distance, duration } = useMemo(
    () => ({
      distance: toDisplayDistance(totalDistanceKm(track), preferences.unitSystem).toFixed(1),
      duration: formatDuration(trackDurationMs(track))
    }),
    [track, preferences.unitSystem]
  );

  const handleQuickLog = async (type: LogType, title: string) => {
    if (!canEdit) return;
    if (!position) {
      notify(t('cockpit.waitingForGps'), 'danger');
      return;
    }
    if (!tripId) return;
    setIsLogging(true);
    try {
      const event: LogEvent = {
        timestamp: Date.now(),
        author: user,
        type,
        title,
        lat: position.lat,
        lng: position.lng
      };
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'events')), event));
      notify(t('cockpit.logged', { title }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    } finally {
      setIsLogging(false);
    }
  };

  // Zwei getrennte Fragen, zwei getrennte Anzeigen: Steht die Ortung? Und
  // wird gerade aufgezeichnet? Vorher teilten sich beide eine Zeile, in der
  // „Pausiert" den GPS-Status verdeckte.
  const gpsTone = error ? 'danger' : position ? 'live' : 'idle';
  const gpsLabel = error ?? (position ? t('cockpit.gpsActive') : t('cockpit.gpsSearching'));
  const recordingTone = !isTracking ? 'idle' : isPaused ? 'warning' : 'active';
  const recordingLabel = !isTracking
    ? t('cockpit.recordingOff')
    : isPaused
      ? t('cockpit.recordingPaused')
      : t('cockpit.recording');

  const coordinates = position
    ? `${Math.abs(position.lat).toFixed(4)}° ${t(position.lat >= 0 ? 'cockpit.north' : 'cockpit.south')}` +
      `  ${Math.abs(position.lng).toFixed(4)}° ${t(position.lng >= 0 ? 'cockpit.east' : 'cockpit.west')}`
    : t('cockpit.noValue');

  const visibleQuickLogs = showAllQuickLogs ? quickLogs : quickLogs.slice(0, VISIBLE_QUICK_LOGS);
  const hiddenQuickLogCount = Math.max(0, quickLogs.length - VISIBLE_QUICK_LOGS);

  return (
    <div className="cockpit">
      {/* Ebene 1: Expedition – welcher Roadtrip, wer ist an Bord. */}
      <header className="cockpit-header">
        <h1 className="page-title cockpit-title">{tripName ?? t('cockpit.title')}</h1>
        <div
          className="profile-chip"
          title={t('cockpit.signedInAs', { name: user })}
          aria-label={t('cockpit.signedInAs', { name: user })}
        >
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="profile-chip-name">{user}</span>
        </div>
      </header>

      {/* Ebene 2+3: das Instrument. Nur Anzeige – die Bedienung sitzt darunter
          auf dem Papier, damit die Fläche das bleibt, was sie ist: ein
          Ablesegerät. */}
      <section className="instrument" aria-label={t('cockpit.title')}>
        <div className="instrument-statusbar">
          <span className={`instrument-status instrument-status-${gpsTone}`}>
            <Satellite size={15} strokeWidth={2} aria-hidden="true" />
            <span>{gpsLabel}</span>
          </span>
          <span className={`instrument-status instrument-status-${recordingTone}`}>
            <Circle
              size={11}
              strokeWidth={2}
              /* Gefüllt heißt: läuft. Der Zustand hängt damit nicht an der
                 Farbe allein. */
              fill={isTracking && !isPaused ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            <span>{recordingLabel}</span>
          </span>
        </div>

        <div className="instrument-speed">
          <span
            className={`instrument-speed-value${position ? '' : ' instrument-speed-value-empty'}`}
          >
            {position
              ? toDisplaySpeed(position.speedKmh, preferences.unitSystem).toFixed(1)
              : t('cockpit.noValue')}
          </span>
          <span className="instrument-speed-unit">{speedUnitLabel(preferences.unitSystem)}</span>
        </div>

        <dl className="instrument-readout">
          <div className="instrument-readout-item">
            <dt className="label">{t('logbook.distance')}</dt>
            <dd className="instrument-readout-value">
              {distance} {distanceUnitLabel(preferences.unitSystem)}
            </dd>
          </div>
          <div className="instrument-readout-item">
            <dt className="label">{t('logbook.duration')}</dt>
            <dd className="instrument-readout-value">{duration}</dd>
          </div>
          <div className="instrument-readout-item instrument-readout-item-wide">
            <dt className="label">{t('cockpit.position')}</dt>
            <dd className="instrument-readout-value">{coordinates}</dd>
          </div>
        </dl>
      </section>

      {/* Ebene 4: primäre Aktionen, in Daumenreichweite direkt unter dem
          Instrument. */}
      <div className="cockpit-actions">
        {isTracking ? (
          <>
            <Button variant="secondary" fullWidth onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              {isPaused ? t('cockpit.resumeTour') : t('cockpit.pauseTour')}
            </Button>
            <Button variant="destructive" fullWidth onClick={() => setIsTracking(false)}>
              <Square size={18} fill="currentColor" />
              {t('cockpit.stopTour')}
            </Button>
          </>
        ) : (
          <Button variant="primary" fullWidth disabled={!canEdit} onClick={() => setIsTracking(true)}>
            <Play size={18} fill="currentColor" />
            {t('cockpit.startTour')}
          </Button>
        )}
      </div>

      {!canEdit && <p className="helper-text cockpit-note">{t('crew.readonlyHint')}</p>}

      {/* Ebene 5: Log erfassen. */}
      <section className="cockpit-section">
        <h2 className="section-title">{t('cockpit.addLog')}</h2>

        {quickLogs.length === 0 ? (
          <EmptyState title={t('cockpit.noQuickLogs')} hint={t('cockpit.noQuickLogsHint')} />
        ) : (
          <>
            <div className="quick-log-grid">
              {visibleQuickLogs.map(({ id, label, iconName }) => {
                const Icon = getQuickLogIcon(iconName);
                return (
                  <button
                    key={id}
                    className="quick-log-btn"
                    disabled={isLogging || !position || !canEdit}
                    onClick={() => handleQuickLog(id, label)}
                  >
                    <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {hiddenQuickLogCount > 0 && (
              <button
                type="button"
                className="cockpit-disclosure"
                aria-expanded={showAllQuickLogs}
                onClick={() => setShowAllQuickLogs((open) => !open)}
              >
                {showAllQuickLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showAllQuickLogs
                  ? t('cockpit.fewerLogs')
                  : t('cockpit.moreLogs', { count: hiddenQuickLogCount })}
              </button>
            )}
          </>
        )}
      </section>

      {/* Ebene 6: was heute schon passiert ist. Die vollständige Liste steht
          im Logbuch – hier reicht der Blick auf die letzten Einträge. */}
      <section className="cockpit-section">
        <h2 className="section-title">{t('cockpit.today')}</h2>
        {todaysEvents.length === 0 ? (
          <p className="helper-text cockpit-note">{t('cockpit.noEntriesToday')}</p>
        ) : (
          <ul className="cockpit-daylog">
            {todaysEvents.slice(0, TODAY_PREVIEW_COUNT).map((event) => (
              <li key={event.id} className="cockpit-daylog-entry">
                <span className="cockpit-daylog-time">
                  {new Date(event.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span className="cockpit-daylog-title">{event.title}</span>
                <span className="cockpit-daylog-author">{event.author}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
