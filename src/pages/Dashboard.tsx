import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Play, Pause, Square, Satellite, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../firebase';
import { useTracking } from '../hooks/useTracking';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { useCollection } from '../hooks/useCollection';
import { usePermissions } from '../hooks/usePermissions';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs, useTripDates } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { activeOnly } from '../lib/trash';
import { readActiveSession } from '../lib/activeTrackSession';
import {
  formatDuration,
  pointsOfDay,
  pointsOfSession,
  totalDistanceKm,
  trackDurationMs
} from '../lib/tripStats';
import {
  distanceUnitLabel,
  speedUnitLabel,
  toDisplayDistance,
  toDisplaySpeed
} from '../lib/units';
import { GpsPoint, LogType, LogEvent } from '../types';
import { useT } from '../i18n';
import { Button, EmptyState, SegmentedControl, Toggle, useToast } from '../components/ui';
import { DriveMap } from '../components/DriveMap';
import { TrackSessionDialog } from '../components/TrackSessionDialog';
import './Dashboard.css';

/**
 * Wie viele Schnell-Log-Tasten nebeneinander stehen – dieselben Schwellen wie
 * `.quick-log-grid` in Dashboard.css. Beides muss zusammen geändert werden:
 * Nur so weiß das Cockpit, wie viele Tasten eine Reihe fasst.
 */
const QUICK_LOG_COLUMNS = [
  { query: '(min-width: 1280px)', columns: 6 },
  { query: '(min-width: 600px)', columns: 4 }
] as const;

const QUICK_LOG_COLUMNS_BASE = 3;

function currentQuickLogColumns(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return QUICK_LOG_COLUMNS_BASE;
  }
  for (const { query, columns } of QUICK_LOG_COLUMNS) {
    if (window.matchMedia(query).matches) return columns;
  }
  return QUICK_LOG_COLUMNS_BASE;
}

/**
 * Wie viele Schnell-Logs eine Reihe im Cockpit gerade fasst.
 *
 * Die Einstellung wird in Reihen gewählt, das Aufklappen rechnet aber in
 * Tasten – beim Drehen des Geräts muss die Grenze also mitwandern.
 */
function useQuickLogColumns(): number {
  const [columns, setColumns] = useState(currentQuickLogColumns);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const lists = QUICK_LOG_COLUMNS.map(({ query }) => window.matchMedia(query));
    const update = () => setColumns(currentQuickLogColumns());
    update();
    lists.forEach((list) => list.addEventListener('change', update));
    return () => lists.forEach((list) => list.removeEventListener('change', update));
  }, []);

  return columns;
}

/**
 * Worauf sich Strecke und Dauer im Instrument beziehen.
 *
 * Drei Fragen, die unterwegs alle vorkommen: `session` ist die gerade
 * laufende Route, `day` der ganze heutige Tag – auch wenn er aus zwei oder
 * drei Routen mit Pausen dazwischen besteht – und `trip` die Gesamtspur des
 * Roadtrips. `session` gibt es nur, solange aufgezeichnet wird; ohne
 * laufende Aufzeichnung bleiben Tag und Gesamt.
 */
type StatsScope = 'trip' | 'day' | 'session';

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

/** Tag X von Y, nur während der Roadtrip tatsächlich läuft (heute zwischen
 * Start- und Enddatum, beide inklusive). Davor/danach oder ganz ohne
 * hinterlegtes Datum bleibt die Anzeige schlicht weg, statt einen
 * Sonderfall-Text einzuführen – siehe Kombüse-Speiseplan für das Nachtragen
 * des Reisezeitraums. */
function dayOfTrip(startDate: string | undefined, endDate: string | undefined): { day: number; total: number } | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (todayUtc.getTime() < start.getTime() || todayUtc.getTime() > end.getTime()) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  const day = Math.round((todayUtc.getTime() - start.getTime()) / msPerDay) + 1;
  const total = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  return { day, total };
}

export default function Dashboard({ user }: { user: string }) {
  const {
    position,
    error,
    isTracking,
    setIsTracking,
    activeSessionId,
    isPaused,
    setIsPaused,
    finishedSession,
    dismissFinishedSession,
    screenLockHeld,
    screenLockSupported
  } = useTracking();
  const { tripId, tripName } = useRoadtrip();
  const { canEdit } = usePermissions(user);
  const quickLogs = useQuickLogs();
  const { startDate, endDate } = useTripDates();
  const { preferences } = usePreferences();
  const quickLogColumns = useQuickLogColumns();
  const [isLogging, setIsLogging] = useState(false);
  const [showAllQuickLogs, setShowAllQuickLogs] = useState(false);
  // Reine Ansichtssache: Der Fahrmodus räumt den Bildschirm für die Fahrt frei
  // und hat mit der Aufzeichnung nichts zu tun – er startet und stoppt nichts.
  // Deshalb auch nicht gespeichert: Wer die App neu öffnet, sitzt nicht
  // zwangsläufig wieder am Steuer.
  const [driveMode, setDriveMode] = useState(false);
  // Beginnt beim heutigen Tag: Das ist die Zahl, die unterwegs am häufigsten
  // gesucht wird und die es auch ohne laufende Aufzeichnung gibt.
  const [statsScope, setStatsScope] = useState<StatsScope>('day');
  const { notify } = useToast();
  const t = useT();

  // Wie weit die Spur zurück geladen wird. Das Cockpit zeigt je nach
  // Ausschnitt nur den heutigen Tag oder die laufende Aufzeichnung – dafür
  // die ganze Reise zu abonnieren, hieße nach ein paar Wochen zehntausende
  // Punkte zu laden, um ein paar hundert anzuzeigen. Nur „Ganze Reise"
  // braucht wirklich alles (null).
  //
  // Die laufende Aufzeichnung kann über Mitternacht hinausreichen (nachts um
  // eins ist die Tour dieselbe), deshalb zählt bei ihr die Startzeit und
  // nicht der Tagesbeginn. Gelesen wird sie aus localStorage, wo
  // hooks/useTracking sie über Neustarts hinweg führt.
  const trackSince = useMemo(() => {
    if (statsScope === 'trip') return null;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    if (statsScope !== 'session') return startOfToday;
    const active = readActiveSession();
    return Math.min(startOfToday, active?.startedAt ?? startOfToday);
  }, [statsScope, activeSessionId]);

  // Dieselben Abos wie im Logbuch – die Werte im Instrument sind die Zahlen,
  // die dort ausführlich stehen, hier nur als laufende Anzeige.
  const track = useCollection<GpsPoint>(
    tripId ? tripPath(tripId, 'track') : null,
    'timestamp',
    'asc',
    trackSince
  );
  const allEvents = useCollection<LogEvent>(
    tripId ? tripPath(tripId, 'events') : null,
    'timestamp',
    'desc'
  );

  const todaysEvents = useMemo(
    () => activeOnly(allEvents).filter((event) => isToday(event.timestamp)),
    [allEvents]
  );

  // Endet die Aufzeichnung, fällt die Anzeige auf den heutigen Tag zurück –
  // ein hängen gebliebenes „Aktuelle Route" würde sonst dauerhaft 0 anzeigen,
  // und der Tag enthält die eben beendete Route ohnehin.
  useEffect(() => {
    if (!activeSessionId) setStatsScope((scope) => (scope === 'session' ? 'day' : scope));
  }, [activeSessionId]);

  // Der gewählte Ausschnitt der Spur: die laufende Aufzeichnung anhand der
  // Kennung, die jeder Punkt mitträgt (siehe hooks/useTracking.tsx), der
  // heutige Kalendertag über den Zeitstempel, sonst alles.
  const scopedTrack = useMemo(() => {
    if (statsScope === 'session') return pointsOfSession(track, activeSessionId);
    if (statsScope === 'day') return pointsOfDay(track);
    return track;
  }, [track, statsScope, activeSessionId]);

  const { distance, duration } = useMemo(
    () => ({
      distance: toDisplayDistance(totalDistanceKm(scopedTrack), preferences.unitSystem).toFixed(1),
      duration: formatDuration(trackDurationMs(scopedTrack))
    }),
    [scopedTrack, preferences.unitSystem]
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

  // `quickLogRows === 0` heißt „alle anzeigen" – dann gibt es nichts zum
  // Aufklappen, sonst füllt jede gewählte Reihe so viele Tasten, wie in der
  // aktuellen Breite nebeneinander passen.
  const visibleQuickLogCount =
    preferences.quickLogRows === 0 ? quickLogs.length : preferences.quickLogRows * quickLogColumns;
  const visibleQuickLogs = showAllQuickLogs
    ? quickLogs
    : quickLogs.slice(0, visibleQuickLogCount);
  const hiddenQuickLogCount = Math.max(0, quickLogs.length - visibleQuickLogCount);
  const tripDay = dayOfTrip(startDate, endDate);

  // GPS-Status und Geschwindigkeit stehen in beiden Modi – einmal beschrieben,
  // damit der Fahrmodus nicht zu einer zweiten, langsam auseinanderlaufenden
  // Anzeige derselben Werte wird.
  const gpsStatus = (
    <span className={`instrument-status instrument-status-${gpsTone}`}>
      <Satellite size={15} strokeWidth={2} aria-hidden="true" />
      <span>{gpsLabel}</span>
    </span>
  );

  const speedReadout = (
    <div className="instrument-speed">
      <span className={`instrument-speed-value${position ? '' : ' instrument-speed-value-empty'}`}>
        {position
          ? toDisplaySpeed(position.speedKmh, preferences.unitSystem).toFixed(1)
          : t('cockpit.noValue')}
      </span>
      <span className="instrument-speed-unit">{speedUnitLabel(preferences.unitSystem)}</span>
    </div>
  );

  /* „Wie weit, wie lange" hat unterwegs drei Antworten: die laufende Route,
     der heutige Tag mit allen Routen darin, der ganze Roadtrip. Die Wahl der
     laufenden Route steht nur da, solange aufgezeichnet wird – sonst wäre sie
     eine Wahl zwischen derselben Zahl und derselben Zahl. */
  const scopeOptions: { value: StatsScope; label: string }[] = [
    ...(activeSessionId ? [{ value: 'session' as const, label: t('cockpit.scopeSession') }] : []),
    { value: 'day', label: t('cockpit.scopeDay') },
    { value: 'trip', label: t('cockpit.scopeTrip') }
  ];

  const scopeSwitch = (
    <div className="cockpit-scope">
      <span className="label cockpit-scope-label">{t('cockpit.scopeLabel')}</span>
      <SegmentedControl
        value={statsScope}
        options={scopeOptions}
        onChange={setStatsScope}
        label={t('cockpit.scopeLabel')}
      />
    </div>
  );

  // Im Fahrmodus fehlt der Umschalter – dort sagt der Zusatz an der
  // Beschriftung, welche der drei Zahlen gerade dasteht.
  const scopeLabels: Record<StatsScope, string> = {
    session: t('cockpit.scopeSession'),
    day: t('cockpit.scopeDay'),
    trip: t('cockpit.scopeTrip')
  };
  const scopeNote = ` · ${scopeLabels[statsScope]}`;

  // Der Umschalter steht in beiden Modi an derselben Stelle oben rechts:
  // Wer im Fahrmodus zurück will, sucht ihn dort, wo er ihn eingeschaltet hat.
  const driveModeSwitch = (
    <div className="cockpit-drive-switch">
      <span className="cockpit-drive-switch-label">{t('cockpit.driveMode')}</span>
      <Toggle checked={driveMode} onChange={setDriveMode} label={t('cockpit.driveMode')} />
    </div>
  );

  /* Nach dem Stoppen: die Aufzeichnung benennen, damit sie später
     wiederzufinden ist. Rendert sich selbst als Portal und liefert null,
     solange keine Aufzeichnung wartet – deshalb steht sie in beiden Modi an
     derselben Stelle. */
  const saveDialog = (
    <TrackSessionDialog
      session={finishedSession}
      points={track}
      author={user}
      onClose={dismissFinishedSession}
    />
  );

  /* Fahrmodus: alles weg, was am Steuer nicht abgelesen wird. Keine
     Schnell-Logs, kein Tageslog, keine Tour-Tasten – die Aufzeichnung läuft
     davon unberührt weiter oder eben nicht, der Fahrmodus rührt sie nicht an.
     Übrig bleiben Geschwindigkeit, Position, GPS-Status und die Karte, die
     der eigenen Position folgt. */
  if (driveMode) {
    return (
      <div className="cockpit-drive">
        <header className="cockpit-header">
          <h1 className="page-title cockpit-title">{tripName ?? t('cockpit.title')}</h1>
          {driveModeSwitch}
        </header>

        <section className="instrument cockpit-drive-instrument" aria-label={t('cockpit.title')}>
          {speedReadout}
          <div className="cockpit-drive-facts">
            {gpsStatus}
            {/* Die gefahrene Strecke steht am Steuer neben der Geschwindigkeit:
                Sie beantwortet die Frage, wie weit es heute schon ging, ohne
                dafür den Fahrmodus verlassen zu müssen. Es ist dieselbe Zahl
                wie im Instrument und im Logbuch. */}
            <div className="cockpit-drive-distance">
              <span className="label">
                {t('logbook.distance')}
                {scopeNote}
              </span>
              <span className="cockpit-drive-distance-value">
                {distance} {distanceUnitLabel(preferences.unitSystem)}
              </span>
            </div>
            <div className="cockpit-drive-coords">{coordinates}</div>
          </div>
        </section>

        <div className="cockpit-drive-map">
          <DriveMap position={position} user={user} />
        </div>
        {saveDialog}
      </div>
    );
  }

  return (
    <div className="cockpit">
      {/* Ebene 1: Expedition – welcher Roadtrip, wer ist an Bord. */}
      <header className="cockpit-header">
        <h1 className="page-title cockpit-title">{tripName ?? t('cockpit.title')}</h1>
        {driveModeSwitch}
        <div
          className="profile-chip"
          title={t('cockpit.signedInAs', { name: user })}
          aria-label={t('cockpit.signedInAs', { name: user })}
        >
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="profile-chip-name">{user}</span>
        </div>
      </header>

      {/* Zwei Gruppen statt sechs gleichrangiger Blöcke: links ablesen und
          steuern (Ebenen 2–4), rechts erfassen und nachlesen (Ebenen 5+6).
          Im Hochformat stehen sie untereinander und ergeben exakt die
          bisherige Reihenfolge; ab Tablet-Querformat werden zwei Spalten
          daraus (siehe Dashboard.css). */}
      <div className="cockpit-primary">
        {/* Ebene 2+3: das Instrument. Nur Anzeige – die Bedienung sitzt darunter
            auf dem Papier, damit die Fläche das bleibt, was sie ist: ein
            Ablesegerät. */}
        <section className="instrument" aria-label={t('cockpit.title')}>
          <div className="instrument-statusbar">
            {gpsStatus}
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

          {speedReadout}

          <dl className="instrument-readout">
            {tripDay && (
              <div className="instrument-readout-item">
                <dt className="label">{t('cockpit.tripDayLabel')}</dt>
                <dd className="instrument-readout-value">
                  {t('cockpit.dayOfTrip', { day: tripDay.day, total: tripDay.total })}
                </dd>
              </div>
            )}
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

        {/* Der Bezug von Strecke und Dauer – auf dem Papier, nicht im
            Instrument: Das Instrument bleibt ein reines Ablesegerät. */}
        {scopeSwitch}

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

        {/* Nur während der Aufzeichnung und nur einmal: Was mit der Spur
            passiert, wenn das Handy zugeht, ist genau dann die Frage. */}
        {isTracking && !screenLockSupported && (
          <p className="helper-text cockpit-note">{t('cockpit.screenLockUnavailable')}</p>
        )}
        {isTracking && screenLockHeld && (
          <p className="helper-text cockpit-note">{t('cockpit.screenLockHint')}</p>
        )}

        {!canEdit && <p className="helper-text cockpit-note">{t('crew.readonlyHint')}</p>}
      </div>

      <div className="cockpit-secondary">
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
      {saveDialog}
    </div>
  );
}
