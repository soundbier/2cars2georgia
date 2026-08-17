import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Anchor, Coffee, AlertTriangle, MapPin, Home, Play, Square } from 'lucide-react';
import { db } from './firebase';
import { useTracking } from './useTracking';
import { LogType, LogEvent } from './types';

interface Props {
  user: string;
  isTracking: boolean;
  setIsTracking: (val: boolean) => void;
}

export default function Dashboard({ user, isTracking, setIsTracking }: Props) {
  const { currentPosition, error } = useTracking(user, isTracking);
  const [isLogging, setIsLogging] = useState(false);

  const handleQuickLog = async (type: LogType, title: string) => {
    if (!currentPosition) {
      alert('Warte auf GPS-Signal...');
      return;
    }
    setIsLogging(true);
    try {
      const event: LogEvent = {
        timestamp: Date.now(),
        author: user,
        type,
        title,
        lat: currentPosition.lat,
        lng: currentPosition.lng
      };
      await addDoc(collection(db, 'events'), event);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern.');
    }
    setIsLogging(false);
  };

  return (
    <div>
      <h2>Hallo {user} 👋</h2>
      
      {/* GPS Geschwindigkeits-Widget */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          {error ? <span style={{ color: 'var(--danger)' }}>{error}</span> : currentPosition ? <span style={{ color: 'var(--success)' }}>GPS Aktiv</span> : 'Suche Satelliten...'}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h1 style={{ fontSize: '4.5rem', fontWeight: '800', lineHeight: '1', color: currentPosition ? 'var(--text)' : 'var(--surface-border)' }}>
            {currentPosition ? currentPosition.speedKmh.toFixed(1) : '0.0'}
          </h1>
          <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: '600' }}>km/h</span>
        </div>
      </div>
      
      {/* Tracking Button */}
      <button 
        className="btn" 
        style={{ 
          width: '100%', 
          marginBottom: '30px', 
          background: isTracking ? 'var(--danger)' : 'var(--success)' 
        }}
        onClick={() => setIsTracking(!isTracking)}
      >
        {isTracking ? <><Square size={20} fill="currentColor" /> Tracking stoppen</> : <><Play size={20} fill="currentColor" /> Tour starten</>}
      </button>

      {/* Schnell-Logs Grid */}
      <h3>Schnell-Logs</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <button className="btn btn-log" disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('schleuse', 'Schleuse')}>
          <Anchor size={24} strokeWidth={1.5} />
          <span>Schleuse</span>
        </button>
        <button className="btn btn-log" disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('pause', 'Pause')}>
          <Coffee size={24} strokeWidth={1.5} />
          <span>Pause</span>
        </button>
        <button className="btn btn-log" disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('anlegen', 'Anlegen')}>
          <Home size={24} strokeWidth={1.5} />
          <span>Anlegen</span>
        </button>
        <button className="btn btn-log" disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('grenze', 'Landesgrenze')}>
          <MapPin size={24} strokeWidth={1.5} />
          <span>Grenze</span>
        </button>
        <button className="btn btn-log" disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('panne', 'Panne')}>
          <AlertTriangle size={24} strokeWidth={1.5} color="var(--danger)" />
          <span>Panne</span>
        </button>
      </div>
    </div>
  );
}
