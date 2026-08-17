import { useMemo } from 'react';
import { Navigation, Clock, User, BookOpen } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { useQuickLogs } from '../hooks/useSettings';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { LogEvent, GpsPoint } from '../types';
import { PageHeader, EmptyState } from '../components/ui';
import './Stats.css';

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Gesamtstrecke entlang der Trackpunkte (Haversine) in Kilometern. */
function totalDistanceKm(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dLat = toRadians(curr.lat - prev.lat);
    const dLng = toRadians(curr.lng - prev.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(prev.lat)) * Math.cos(toRadians(curr.lat)) * Math.sin(dLng / 2) ** 2;
    total += EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function formatDuration(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function Stats() {
  const quickLogs = useQuickLogs();
  const events = useCollection<LogEvent>('events', 'timestamp', 'desc');
  const track = useCollection<GpsPoint>('track');

  const { distance, duration } = useMemo(
    () => ({
      distance: totalDistanceKm(track).toFixed(1),
      duration: formatDuration(
        track.length > 1 ? track[track.length - 1].timestamp - track[0].timestamp : 0
      )
    }),
    [track]
  );

  return (
    <div>
      <PageHeader title="Logbuch" subtitle="Strecke, Dauer und Ereignisse der Reise" />

      <div className="logbook-summary">
        <div className="logbook-summary-item">
          <Navigation size={16} strokeWidth={1.75} />
          <div>
            <div className="mono-num logbook-summary-value">{distance} km</div>
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
          {events.map((evt) => {
            const Icon = getQuickLogIcon(quickLogs.find((q) => q.id === evt.type)?.iconName);
            const timestamp = new Date(evt.timestamp);
            return (
              <div key={evt.id} className="logbook-entry">
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
                  <div className="logbook-entry-title">{evt.title}</div>
                  <div className="row helper-text">
                    <User size={13} />
                    <span>{evt.author}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
