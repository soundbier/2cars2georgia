import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Navigation, Clock, User, BookOpen } from 'lucide-react';
import { db } from './firebase';
import { useQuickLogs } from './useQuickLogs';
import { getQuickLogIcon } from './quickLogIcons';
import { LogEvent, GpsPoint } from './types';
import { PageHeader, EmptyState } from './components/ui';
import './Stats.css';


interface Props {
  user: string;
}

function calculateDistance(points: GpsPoint[]): string {
  if (points.length < 2) return '0.0';
  let total = 0;
  const R = 6371; // Erdradius in km
  for (let i = 1; i < points.length; i++) {
    const lat1 = points[i - 1].lat;
    const lon1 = points[i - 1].lng;
    const lat2 = points[i].lat;
    const lon2 = points[i].lng;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total.toFixed(1);
}

export default function Stats({ user: _user }: Props) {
  const { quickLogs } = useQuickLogs();
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [distance, setDistance] = useState<string>('0.0');
  const [trackingTime, setTrackingTime] = useState<string>('0h 0m');

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), orderBy('timestamp', 'desc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      const evts: LogEvent[] = [];
      snapshot.forEach((doc) => {
        evts.push({ id: doc.id, ...doc.data() } as LogEvent);
      });
      setEvents(evts);
    });

    const qTrack = query(collection(db, 'track'), orderBy('timestamp', 'asc'));
    const unsubTrack = onSnapshot(qTrack, (snapshot) => {
      const pts: GpsPoint[] = [];
      snapshot.forEach((doc) => {
        pts.push(doc.data() as GpsPoint);
      });

      setDistance(calculateDistance(pts));

      if (pts.length > 0) {
        const first = pts[0].timestamp;
        const last = pts[pts.length - 1].timestamp;
        const diffMs = last - first;
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        setTrackingTime(`${hrs}h ${mins}m`);
      }
    });

    return () => {
      unsubEvents();
      unsubTrack();
    };
  }, []);

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
            <div className="mono-num logbook-summary-value">{trackingTime}</div>
            <div className="label">Dauer</div>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>
        Ereignisse ({events.length})
      </div>

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
            return (
              <div key={evt.id} className="logbook-entry">
                <div className="logbook-entry-time">
                  <span className="logbook-entry-time-row">
                    <Icon size={14} strokeWidth={1.75} color="var(--color-accent)" />
                    <span className="mono-num">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="helper-text">{new Date(evt.timestamp).toLocaleDateString()}</span>
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
