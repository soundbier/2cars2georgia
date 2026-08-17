import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Activity, Map, Clock, User } from 'lucide-react';
import { db } from './firebase';
import { LogEvent } from './types';

interface Props {
  user: string;
}

export default function Stats({ user }: Props) {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [gpsCount, setGpsCount] = useState<number>(0);

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), orderBy('timestamp', 'desc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      const evts: LogEvent[] = [];
      snapshot.forEach((doc) => {
        evts.push({ id: doc.id, ...doc.data() } as LogEvent);
      });
      setEvents(evts);
    });

    const qTrack = query(collection(db, 'track'));
    const unsubTrack = onSnapshot(qTrack, (snapshot) => {
      setGpsCount(snapshot.size);
    });

    return () => {
      unsubEvents();
      unsubTrack();
    };
  }, []);

  return (
    <div>
      <h2>Logbuch & Stats</h2>
      
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px 20px' }}>
        <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '50%' }}>
          <Map size={28} color="var(--primary)" />
        </div>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Gespeicherte GPS-Punkte
          </p>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.8rem', color: 'var(--text)' }}>
            {gpsCount}
          </h3>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '24px' }}>
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
