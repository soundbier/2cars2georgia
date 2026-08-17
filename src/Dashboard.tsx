import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Anchor, Coffee, AlertTriangle, MapPin, Home, Play, Square, Satellite } from 'lucide-react';
import { db } from './firebase';
import { useTracking } from './useTracking';
import { LogType, LogEvent } from './types';
import { Button, useToast } from './components/ui';
import './Dashboard.css';

interface Props {
  user: string;
  isTracking: boolean;
  setIsTracking: (val: boolean) => void;
}

const QUICK_LOGS: { type: LogType; title: string; icon: typeof Anchor; danger?: boolean }[] = [
  { type: 'schleuse', title: 'Schleuse', icon: Anchor },
  { type: 'pause', title: 'Pause', icon: Coffee },
  { type: 'anlegen', title: 'Anlegen', icon: Home },
  { type: 'grenze', title: 'Grenze', icon: MapPin },
  { type: 'panne', title: 'Panne', icon: AlertTriangle, danger: true }
];

export default function Dashboard({ user, isTracking, setIsTracking }: Props) {
  const { currentPosition, error } = useTracking(user, isTracking);
  const [isLogging, setIsLogging] = useState(false);
  const { notify } = useToast();

  const handleQuickLog = async (type: LogType, title: string) => {
    if (!currentPosition) {
      notify('Warte auf GPS-Signal …', 'danger');
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
      notify(`„${title}“ protokolliert`, 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    }
    setIsLogging(false);
  };

  const gpsStatus = error ? 'error' : currentPosition ? 'active' : 'searching';

  return (
    <div>
      <p className="helper-text" style={{ marginBottom: 2 }}>
        Angemeldet als
      </p>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-5)' }}>
        {user}
      </h1>

      {/* Bordinstrument: GPS-Status → Geschwindigkeit → Tracking */}
      <div className="instrument">
        <div className={`instrument-status instrument-status-${gpsStatus}`}>
          <Satellite size={13} />
          <span>{error ? error : currentPosition ? 'GPS aktiv' : 'Suche Satelliten …'}</span>
        </div>

        <div className="instrument-speed">
          <span className="instrument-speed-value mono-num">
            {currentPosition ? currentPosition.speedKmh.toFixed(1) : '—'}
          </span>
          <span className="instrument-speed-unit">km/h</span>
        </div>

        <Button
          variant={isTracking ? 'destructive' : 'primary'}
          fullWidth
          onClick={() => setIsTracking(!isTracking)}
        >
          {isTracking ? (
            <>
              <Square size={18} fill="currentColor" /> Tour stoppen
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" /> Tour starten
            </>
          )}
        </Button>
      </div>

      {/* Schnell-Logs */}
      <div className="section-title" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>
        Schnell-Logs
      </div>
      <div className="quick-log-grid">
        {QUICK_LOGS.map(({ type, title, icon: Icon, danger }) => (
          <button
            key={type}
            className="quick-log-btn"
            disabled={isLogging || !currentPosition}
            onClick={() => handleQuickLog(type, title)}
          >
            <Icon size={22} strokeWidth={1.75} color={danger ? 'var(--color-danger)' : 'var(--color-accent)'} />
            <span>{title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
