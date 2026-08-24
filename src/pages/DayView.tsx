import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Image, Navigation, Users } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { usePreferences } from '../hooks/usePreferences';
import { useQuickLogs } from '../hooks/useSettings';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { groupByDay, mostRecentDay } from '../lib/dayRecap';
import { activeOnly } from '../lib/trash';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { formatDuration } from '../lib/tripStats';
import { useI18n, useT } from '../i18n';
import { GpsPoint, LogEvent } from '../types';
import { Button, EmptyState, ListItem, PageHeader, Section, Select } from '../components/ui';
import { SettingsSectionNav } from '../components/SettingsSectionNav';
import { DayRecapDialog } from '../components/DayRecapDialog';
// Die Kennzahlen sehen aus wie im Logbuch, weil es dieselben sind – nur für
// einen Tag statt für den ganzen Roadtrip.
import './Stats.css';
import './Settings.css';

/**
 * Tagesansicht: Strecke, Dauer und Ereignisse eines einzelnen Kalendertags.
 *
 * Die Zahlen im Cockpit kennen nur zwei Ausschnitte – den ganzen Roadtrip
 * und die gerade laufende Aufzeichnung. Damit steht abends im Hafen, wenn die
 * Aufzeichnung längst gestoppt ist, keine Zahl mehr da, die den heutigen Tag
 * beschreibt: Wer wissen will, wie weit es gestern ging, findet nur die
 * Gesamtsumme. Diese Seite ist deshalb bewusst unabhängig von einer laufenden
 * Aufzeichnung – sie rechnet nachträglich aus Spur und Ereignissen
 * (lib/dayRecap.ts), so wie es das Tagesbild schon tut.
 *
 * Ein Tag im Sinne dieser Seite ist der Kalendertag in der Zeitzone des
 * Geräts, nicht eine Aufzeichnung: Wer nachts um eins noch fährt, sucht das
 * unter dem Tag, an dem er losgefahren ist.
 */
export default function DayView() {
  const { tripId, tripName } = useRoadtrip();
  const { preferences } = usePreferences();
  const { locale } = useI18n();
  const quickLogs = useQuickLogs();
  const t = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);

  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null, 'timestamp', 'asc');
  const storedEvents = useCollection<LogEvent>(
    tripId ? tripPath(tripId, 'events') : null,
    'timestamp',
    'desc'
  );
  // Was im Papierkorb liegt, zählt hier so wenig mit wie im Logbuch.
  const events = useMemo(() => activeOnly(storedEvents), [storedEvents]);

  const days = useMemo(() => groupByDay(track, events), [track, events]);
  const defaultDay = useMemo(() => mostRecentDay(days), [days]);

  // Vorbelegt ist der jüngste Tag mit Spur – der, den man am ehesten sucht.
  // Nachrücken darf die Auswahl nur, solange man sie nicht selbst getroffen
  // hat oder der gewählte Tag verschwunden ist.
  useEffect(() => {
    if (days.some((day) => day.key === selectedKey)) return;
    setSelectedKey(defaultDay?.key ?? null);
  }, [days, defaultDay, selectedKey]);

  const selected = days.find((day) => day.key === selectedKey) ?? null;

  const dayLabel = (date: Date) =>
    date.toLocaleDateString(locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

  if (days.length === 0) {
    return (
      <div className="settings-page">
        <PageHeader title={t('dayView.title')} subtitle={t('dayView.subtitle')} />
        <SettingsSectionNav />
        <EmptyState
          icon={<CalendarDays size={26} strokeWidth={1.5} />}
          title={t('dayView.emptyTitle')}
          hint={t('dayView.emptyHint')}
        />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <PageHeader title={t('dayView.title')} subtitle={t('dayView.subtitle')} />
      <SettingsSectionNav />

      <Section title={t('dayView.dayLabel')}>
        <Select
          value={selectedKey ?? ''}
          aria-label={t('dayView.dayLabel')}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          {days.map((day) => (
            <option key={day.key} value={day.key}>
              {dayLabel(day.date)}
            </option>
          ))}
        </Select>

        {selected && (
          <div className="logbook-summary">
            <div className="logbook-summary-item">
              <Navigation size={16} strokeWidth={1.75} />
              <div>
                <div className="mono-num logbook-summary-value">
                  {toDisplayDistance(selected.distanceKm, preferences.unitSystem).toFixed(1)}{' '}
                  {distanceUnitLabel(preferences.unitSystem)}
                </div>
                <div className="label">{t('dayView.distance')}</div>
              </div>
            </div>
            <div className="logbook-summary-divider" />
            <div className="logbook-summary-item">
              <Clock size={16} strokeWidth={1.75} />
              <div>
                <div className="mono-num logbook-summary-value">
                  {formatDuration(selected.durationMs)}
                </div>
                <div className="label">{t('dayView.duration')}</div>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <p className="helper-text">
            <Users size={13} className="setting-note-icon" />
            {selected.authors.length > 0
              ? t('dayView.authors', { names: selected.authors.join(', ') })
              : t('dayView.noAuthors')}
          </p>
        )}

        <Button variant="secondary" fullWidth onClick={() => setRecapOpen(true)}>
          <Image size={18} /> {t('dayRecap.openButton')}
        </Button>
      </Section>

      <Section title={t('dayView.events', { count: selected?.events.length ?? 0 })}>
        {!selected || selected.events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} strokeWidth={1.75} />}
            title={t('dayView.noEvents')}
            hint={t('dayView.noEventsHint')}
          />
        ) : (
          <div className="settings-list">
            {/* Neueste zuerst, wie im Logbuch – die Gruppierung liefert die
                Ereignisse in der Reihenfolge der Gesamtliste. */}
            {selected.events.map((event) => {
              const quickLog = quickLogs.find((entry) => entry.id === event.type);
              const Icon = getQuickLogIcon(quickLog?.iconName);
              return (
                <ListItem
                  key={event.id}
                  leading={<Icon size={18} strokeWidth={1.75} color="var(--color-accent)" />}
                  title={event.title}
                  subtitle={`${new Date(event.timestamp).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} · ${quickLog?.label ?? event.type} · ${event.author}`}
                />
              );
            })}
          </div>
        )}
      </Section>

      <DayRecapDialog
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        tripName={tripName ?? t('export.defaultTripName')}
        days={days}
        initialDayKey={selectedKey}
      />
    </div>
  );
}
