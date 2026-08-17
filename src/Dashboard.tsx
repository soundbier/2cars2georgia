import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
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
      alert(`"${title}" erfolgreich geloggt!`);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern.');
    }
    setIsLogging(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>Dashboard ({user})</h2>
      
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          GPS Status: {error ? <span style={{ color: '#ef4444' }}>{error}</span> : currentPosition ? <span style={{ color: '#4ade80' }}>Verbunden</span> : 'Suche Signal...'}
        </p>
        <h1 style={{ fontSize: '3.5rem', margin: '8px 0', color: currentPosition ? '#f8fafc' : '#475569' }}>
          {currentPosition ? currentPosition.speedKmh.toFixed(1) : '0.0'}
        </h1>
        <p style={{ color: '#94a3b8' }}>km/h</p>
      </div>
      
      <button 
        className="btn" 
        style={{ width: '100%', marginBottom: '20px', background: isTracking ? '#ef4444' : '#10b981' }}
        onClick={() => setIsTracking(!isTracking)}
      >
        {isTracking ? 'Tracking stoppen' : 'Tracking starten (alle 30s)'}
      </button>

      <h3 style={{ marginBottom: '12px' }}>Schnell-Logs</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button className="btn" style={{ background: '#2563eb' }} disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('schleuse', 'Schleuse')}>Schleuse</button>
        <button className="btn" style={{ background: '#d97706' }} disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('pause', 'Pause')}>Pause</button>
        <button className="btn" style={{ background: '#dc2626' }} disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('panne', 'Panne')}>Panne</button>
        <button className="btn" style={{ background: '#7c3aed' }} disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('grenze', 'Landesgrenze')}>Grenze</button>
        <button className="btn" style={{ background: '#0d9488' }} disabled={isLogging || !currentPosition} onClick={() => handleQuickLog('anlegen', 'Anlegen')}>Anlegen</button>
      </div>
    </div>
  );
}
