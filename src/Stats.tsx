import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { LogEvent, GpsPoint } from './types';

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
      <h2 style={{ marginBottom: '16px' }}>Statistiken & Logbuch</h2>
      
      <div className="card">
        <h3>Tracking-Status</h3>
        <p style={{ marginTop: '8px', color: '#94a3b8' }}>Gespeicherte GPS-Punkte: <strong style={{ color: '#f8fafc' }}>{gpsCount}</strong></p>
      </div>

      <h3 style={{ marginBottom: '12px' }}>Ereignisse ({events.length})</h3>
      {events.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Noch keine Ereignisse geloggt.</p>
      ) : (
        events.map((evt) => (
          <div key={evt.id} className="card" style={{ marginBottom: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{evt.title}</strong>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Autor: {evt.author} | {new Date(evt.timestamp).toLocaleDateString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
