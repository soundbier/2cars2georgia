import { useMemo, useState } from 'react';
import {
  BarChart3,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Pause,
  Route as RouteIcon,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { usePreferences } from '../hooks/usePreferences';
import { useQuickLogs } from '../hooks/useSettings';
import { useTrackSessions } from '../hooks/useTrackSessions';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { activeOnly } from '../lib/trash';
import { groupByDay, DayRecap } from '../lib/dayRecap';
import { formatDuration } from '../lib/tripStats';
import { pointsOfSession, sessionStatsById, EMPTY_SESSION_STATS } from '../lib/trackSession';
import {
  analyzeTrack,
  distanceByAuthor,
  eventCountsByType,
  speedHistogram,
  speedSeries,
  SpeedBucket
} from '../lib/statistics';
import { formatDistance, formatSpeed, toDisplaySpeed } from '../lib/units';
import { GpsPoint, LogEvent, TrackSession } from '../types';
import { useI18n, useT } from '../i18n';
import { EmptyState, PageHeader, Section, Select, SegmentedControl } from '../components/ui';
import { BarRow, StatTile } from '../components/StatTile';
import { SpeedChart } from '../components/SpeedChart';
import './Statistics.css';

/**
 * Worauf sich die Auswertung bezieht.
 *
 * Dieselben drei Fragen wie im Cockpit (siehe pages/Dashboard.tsx), nur
 * rückblickend statt laufend: der ganze Roadtrip, ein einzelner Reisetag, eine
 * einzelne benannte Fahrt. Der Unterschied zum Cockpit ist die freie Wahl –
 * dort geht es immer um heute und die gerade laufende Aufzeichnung.
 */
type ScopeKind = 'trip' | 'day' | 'route';

/** Wie viele Klassen das Geschwindigkeits-Histogramm bekommt. */
const SPEED_BUCKETS = 6;

/**
 * Statistik: die gespeicherten Fahrdaten ausgewertet.
 *
 * Das Logbuch (pages/Stats.tsx) zeigt einzelne Ereignisse, das Cockpit die
 * laufenden Werte – was fehlte, war der Blick zurück: Wie schnell war der
 * schnellste Abschnitt, wie viel der Zeit stand man eigentlich, wer ist wie
 * weit gefahren, welcher Tag war der längste.
 *
 * Alle Zahlen werden aus Trackpunkten und Ereignissen gerechnet
 * (lib/statistics.ts) und nirgends gespeichert – siehe die Begründung dort.
 * Die Seite liest, sie schreibt nichts; deshalb gibt es hier auch keine
 * Rechteprüfung, ein Read-only-Mitglied sieht dieselbe Auswertung.
 */
export default function Statistics() {
  const { tripId } = useRoadtrip();
  const { preferences } = usePreferences();
  const { sessions } = useTrackSessions();
  const quickLogs = useQuickLogs();
  const { locale } = useI18n();
  const t = useT();

  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null, 'timestamp', 'asc');
  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'asc');
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);

  const [kind, setKind] = useState<ScopeKind>('trip');
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const days = useMemo(() => groupByDay(track, events), [track, events]);
  const sessionStats = useMemo(() => sessionStatsById(track), [track]);

  // Ohne getroffene Wahl steht der jüngste Eintrag da: Wer auf „Tag" oder
  // „Route" umschaltet, will fast immer den letzten sehen, nicht den ersten.
  const selectedDay: DayRecap | null =
    days.find((day) => day.key === dayKey) ?? days[0] ?? null;
  const selectedSession: TrackSession | null =
    sessions.find((session) => session.id === sessionId) ?? sessions[0] ?? null;

  /** Trackpunkte und Ereignisse des gewählten Ausschnitts. */
  const scope = useMemo(() => {
    if (kind === 'day') {
      return { points: selectedDay?.track ?? [], events: selectedDay?.events ?? [] };
    }
    if (kind === 'route') {
      if (!selectedSession?.id) return { points: [] as GpsPoint[], events: [] as LogEvent[] };
      return {
        points: pointsOfSession(track, selectedSession.id),
        // Ereignisse tragen keine Kennung der Aufzeichnung – sie werden über
        // Schnell-Log-Tasten erfasst, auch wenn gerade nichts aufgezeichnet
        // wird. Zugeordnet wird deshalb über die Zeit der Fahrt.
        events: events.filter(
          (event) =>
            event.timestamp >= selectedSession.startedAt && event.timestamp <= selectedSession.endedAt
        )
      };
    }
    return { points: track, events };
  }, [kind, selectedDay, selectedSession, track, events]);

  const analysis = useMemo(() => analyzeTrack(scope.points), [scope.points]);
  const series = useMemo(() => speedSeries(scope.points), [scope.points]);
  const histogram = useMemo(() => speedHistogram(scope.points, SPEED_BUCKETS), [scope.points]);
  const crew = useMemo(() => distanceByAuthor(scope.points), [scope.points]);
  const categories = useMemo(() => eventCountsByType(scope.events), [scope.events]);

  const unit = preferences.unitSystem;
  const distance = (km: number) => formatDistance(km, unit);
  const speed = (kmh: number) => formatSpeed(kmh, unit);

  /* Beschriftung einer Geschwindigkeitsklasse, z. B. „10–20 km/h". Die Einheit
     steht nur am oberen Ende, sonst wird die Zeile auf Handybreite zu lang.
     Gerechnet werden die Klassen metrisch (lib/statistics.ts); in Knoten
     ergeben sich dadurch krumme Grenzen, die hier gerundet erscheinen. */
  const bucketLabel = (bucket: SpeedBucket) =>
    bucket.toKmh > bucket.fromKmh
      ? `${toDisplaySpeed(bucket.fromKmh, unit).toFixed(0)}–${formatSpeed(bucket.toKmh, unit, 0)}`
      : formatSpeed(0, unit, 0);
  const movingShare =
    analysis.durationMs > 0 ? Math.round((analysis.movingMs / analysis.durationMs) * 100) : 0;

  const scopeOptions: { value: ScopeKind; label: string }[] = [
    { value: 'trip', label: t('stats.scopeTrip') },
    { value: 'day', label: t('stats.scopeDay') },
    { value: 'route', label: t('stats.scopeRoute') }
  ];

  const dayLabel = (day: DayRecap) =>
    day.date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });

  // Die Gesamtspur enthält auch Punkte ohne Aufzeichnung; „Reisetage" meint
  // deshalb die Tage, an denen tatsächlich eine Strecke entstanden ist.
  const activeDays = days.filter((day) => day.track.length > 1).length;

  const maxDayDistance = Math.max(0, ...days.map((day) => day.distanceKm));
  const maxCrewDistance = Math.max(0, ...crew.map((share) => share.distanceKm));
  const maxCategoryCount = Math.max(0, ...categories.map((entry) => entry.count));
  const maxBucketCount = Math.max(0, ...histogram.map((bucket) => bucket.count));
  const maxSessionDistance = Math.max(
    0,
    ...sessions.map((session) => (session.id ? sessionStats.get(session.id) : undefined)?.distanceKm ?? 0)
  );

  const selectRoute = (id: string | undefined) => {
    if (!id) return;
    setSessionId(id);
    setKind('route');
  };

  return (
    <div className="statistics-page">
      <PageHeader title={t('stats.title')} subtitle={t('stats.subtitle')} />

      {/* Der Ausschnitt steht ganz oben und gilt für alles darunter – jede
          Zahl auf dieser Seite beantwortet dieselbe Frage für denselben
          Zeitraum. */}
      <div className="statistics-scope">
        <SegmentedControl
          value={kind}
          options={scopeOptions}
          onChange={setKind}
          label={t('stats.scopeLabel')}
        />
        {kind === 'day' &&
          (days.length === 0 ? (
            <p className="helper-text">{t('stats.noDays')}</p>
          ) : (
            <Select
              aria-label={t('stats.selectDay')}
              value={selectedDay?.key ?? ''}
              onChange={(e) => setDayKey(e.target.value)}
            >
              {days.map((day) => (
                <option key={day.key} value={day.key}>
                  {dayLabel(day)} · {distance(day.distanceKm)}
                </option>
              ))}
            </Select>
          ))}
        {kind === 'route' &&
          (sessions.length === 0 ? (
            <p className="helper-text">{t('stats.noRoutes')}</p>
          ) : (
            <Select
              aria-label={t('stats.selectRoute')}
              value={selectedSession?.id ?? ''}
              onChange={(e) => setSessionId(e.target.value)}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </Select>
          ))}
      </div>

      {/* Leer ist der Ausschnitt erst, wenn es weder Spur noch Ereignisse gibt:
          Ein Tag, an dem nur ins Logbuch geschrieben wurde, hat zwar keine
          Strecke, aber trotzdem etwas zu zeigen. */}
      {analysis.pointCount === 0 && scope.events.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={26} strokeWidth={1.5} />}
          title={t('stats.empty')}
          hint={t('stats.emptyHint')}
        />
      ) : (
        <>
          <div className="stat-grid">
            <StatTile
              icon={<Navigation size={16} strokeWidth={1.75} />}
              label={t('stats.distance')}
              value={distance(analysis.distanceKm)}
            />
            <StatTile
              icon={<Clock size={16} strokeWidth={1.75} />}
              label={t('stats.duration')}
              value={formatDuration(analysis.durationMs)}
              hint={t('stats.durationHint')}
            />
            <StatTile
              icon={<TrendingUp size={16} strokeWidth={1.75} />}
              label={t('stats.movingTime')}
              value={formatDuration(analysis.movingMs)}
              hint={t('stats.movingShare', { percent: movingShare })}
            />
            <StatTile
              icon={<Pause size={16} strokeWidth={1.75} />}
              label={t('stats.restingTime')}
              value={formatDuration(analysis.restingMs)}
            />
            <StatTile
              icon={<Gauge size={16} strokeWidth={1.75} />}
              label={t('stats.avgSpeed')}
              value={speed(analysis.avgSpeedKmh)}
            />
            <StatTile
              icon={<Gauge size={16} strokeWidth={1.75} />}
              label={t('stats.movingSpeed')}
              value={speed(analysis.movingSpeedKmh)}
              hint={t('stats.movingSpeedHint')}
            />
            <StatTile
              icon={<Zap size={16} strokeWidth={1.75} />}
              label={t('stats.maxSpeed')}
              value={speed(analysis.maxSpeedKmh)}
              hint={
                analysis.maxSpeedAt
                  ? t('stats.maxSpeedAt', {
                      time: new Date(analysis.maxSpeedAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    })
                  : undefined
              }
            />
            <StatTile
              icon={<MapPin size={16} strokeWidth={1.75} />}
              label={t('stats.points')}
              value={analysis.pointCount.toLocaleString(locale)}
              hint={t('stats.eventCount', { count: scope.events.length })}
            />
            {/* Nur im Gesamtblick: Für einen Tag oder eine Fahrt wäre die
                Antwort immer „1" beziehungsweise die Zahl daneben. */}
            {kind === 'trip' && (
              <StatTile
                icon={<RouteIcon size={16} strokeWidth={1.75} />}
                label={t('stats.activeDays')}
                value={String(activeDays)}
                hint={t('stats.routeCount', { count: sessions.length })}
              />
            )}
          </div>

          {/* Ohne Trackpunkte gibt es keine Geschwindigkeit – dann bleibt der
              ganze Abschnitt weg statt einer leeren Achse. */}
          {analysis.pointCount > 0 && (
            <Section title={t('stats.speedSection')}>
              <SpeedChart samples={series} unitSystem={unit} averageKmh={analysis.avgSpeedKmh} />

              <h3 className="label statistics-subhead">{t('stats.speedDistribution')}</h3>
              <p className="helper-text">{t('stats.speedDistributionHint')}</p>
              <div className="stat-bars">
                {histogram.map((bucket) => (
                  <BarRow
                    key={bucket.fromKmh}
                    label={<span className="mono-num">{bucketLabel(bucket)}</span>}
                    value={String(bucket.count)}
                    ratio={maxBucketCount > 0 ? bucket.count / maxBucketCount : 0}
                  />
                ))}
              </div>
            </Section>
          )}

          {crew.length > 0 && (
            <Section title={t('stats.crewSection')}>
              <p className="helper-text">{t('stats.crewHint')}</p>
              <div className="stat-bars">
                {crew.map((share) => (
                  <BarRow
                    key={share.author}
                    label={share.author}
                    hint={t('stats.pointCount', { count: share.pointCount })}
                    value={distance(share.distanceKm)}
                    ratio={maxCrewDistance > 0 ? share.distanceKm / maxCrewDistance : 0}
                  />
                ))}
              </div>
            </Section>
          )}

          <Section title={t('stats.eventsSection')}>
            {categories.length === 0 ? (
              <p className="helper-text">{t('stats.eventsEmpty')}</p>
            ) : (
              <div className="stat-bars">
                {categories.map((entry) => {
                  const config = quickLogs.find((quickLog) => quickLog.id === entry.type);
                  const Icon = getQuickLogIcon(config?.iconName);
                  return (
                    <BarRow
                      key={entry.type}
                      label={
                        <span className="row">
                          <Icon size={14} strokeWidth={1.75} color="var(--color-accent)" />
                          {/* Gelöschte oder aus alten Daten stammende Kategorie:
                              dann steht die rohe Kennung da statt gar nichts. */}
                          <span>{config?.label ?? entry.type}</span>
                        </span>
                      }
                      value={String(entry.count)}
                      ratio={maxCategoryCount > 0 ? entry.count / maxCategoryCount : 0}
                    />
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      {/* Die beiden Ranglisten stehen nur im Gesamtblick – und sind zugleich
          der Weg in den Einzelblick: Ein Tippen auf eine Zeile stellt den
          Ausschnitt oben darauf um. */}
      {kind === 'trip' && days.length > 0 && (
        <Section title={t('stats.daysSection')}>
          <div className="stat-bars">
            {days.map((day) => (
              <BarRow
                key={day.key}
                label={dayLabel(day)}
                hint={formatDuration(day.durationMs)}
                value={distance(day.distanceKm)}
                ratio={maxDayDistance > 0 ? day.distanceKm / maxDayDistance : 0}
                onSelect={() => {
                  setDayKey(day.key);
                  setKind('day');
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {kind === 'trip' && sessions.length > 0 && (
        <Section title={t('stats.routesSection')}>
          <div className="stat-bars">
            {sessions.map((session) => {
              const stats = (session.id ? sessionStats.get(session.id) : undefined) ?? EMPTY_SESSION_STATS;
              return (
                <BarRow
                  key={session.id}
                  label={session.name}
                  hint={`${new Date(session.startedAt).toLocaleDateString(locale)} · ${formatDuration(stats.durationMs)}`}
                  value={distance(stats.distanceKm)}
                  ratio={maxSessionDistance > 0 ? stats.distanceKm / maxSessionDistance : 0}
                  onSelect={() => selectRoute(session.id)}
                />
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
