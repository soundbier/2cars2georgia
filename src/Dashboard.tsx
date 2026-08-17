import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Play, Square, Satellite } from 'lucide-react';
import { db } from './firebase';
import { useTracking } from './useTracking';
import { useQuickLogs } from './useQuickLogs';
import { getQuickLogIcon } from './quickLogIcons';
import { LogType, LogEvent } from './types';
import { Button, EmptyState, useToast } from './components/ui';
import './Dashboard.css';

interface Props {
  user: string;
  isTracking: boolean;
  setIsTracking: (val: boolean) => void;
}

export default function Dashboard({ user, isTracking, setIsTracking }: Props) {
  const { currentPosition, error } = useTracking(user, isTracking);
  const { quickLogs } = useQuickLogs();
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
      <div className="cockpit-header">
        <h1 className="page-title">Test</h1>
        <div className="profile-chip" title={`Angemeldet als ${user}`} aria-label={`Angemeldet als ${user}`}>
          <span className="profile-chip-avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="profile-chip-name">{user}</span>
        </div>
      </div>

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
      {quickLogs.length === 0 ? (
        <EmptyState title="Keine Schnell-Logs konfiguriert" hint="Unter Crew → Schnell-Logs Kategorien anlegen." />
      ) : (
        <div className="quick-log-grid">
          {quickLogs.map(({ id, label, iconName }) => {
            const Icon = getQuickLogIcon(iconName);
            const danger = iconName === 'alert-triangle';
            return (
              <button
                key={id}
                className="quick-log-btn"
                disabled={isLogging || !currentPosition}
                onClick={() => handleQuickLog(id, label)}
              >
                <Icon size={22} strokeWidth={1.75} color={danger ? 'var(--color-danger)' : 'var(--color-accent)'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
