import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Activity, Clock, User, Navigation } from 'lucide-react';
import { db } from './firebase';
import { LogEvent, GpsPoint } from './types';

interface Props {
  user: string;
}

function calculateDistance(points: GpsPoint[]): string {
  if (points.length < 2) return '0.0';
  let total = 0;
  const R = 6371; // Erdradius in km
  for (let i = 1; i < points.length; i++) {
    const lat1 = points[i-1].lat;
    const lon1 = points[i-1].lng;
    const lat2 = points[i].lat;
    const lon2 = points[i].lng;
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    total += R * c;
  }
  return total.toFixed(1);
}

export default function Stats({ user }: Props) {
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
      <h2>Logbuch & Stats</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Navigation size={18} />
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>Strecke</span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{distance} km</h3>
        </div>
        
        <div className="card" style={{ margin: 0, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <Clock size={18} />
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>Dauer</span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{trackingTime}</h3>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Activity size={20} color="var(--text-muted)" />
        <h3 style={{ margin: 0 }}>Ereignisse ({events.length})</h3>
      </div>
      
      {events.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Noch keine Ereignisse geloggt.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.map((evt) => (
            <div key={evt.id} className="card" style={{ margin: 0, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '1.1rem' }}>{evt.title}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Clock size={14} />
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <User size={14} />
                <span>{evt.author}</span>
                <span style={{ margin: '0 4px' }}>•</span>
                <span>{new Date(evt.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
