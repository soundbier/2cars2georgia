import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Play, Square, Satellite } from 'lucide-react';
import { db } from '../firebase';
import { useTracking } from '../hooks/useTracking';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { speedUnitLabel, toDisplaySpeed } from '../lib/units';
import { LogType, LogEvent } from '../types';
import { Button, EmptyState, useToast } from '../components/ui';
import './Dashboard.css';

export default function Dashboard({ user }: { user: string }) {
  const { position, error, isTracking, setIsTracking } = useTracking();
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const [isLogging, setIsLogging] = useState(false);
  const { notify } = useToast();

  const handleQuickLog = async (type: LogType, title: string) => {
    if (!position) {
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
        lat: position.lat,
        lng: position.lng
      };
      await addDoc(collection(db, 'events'), event);
      notify(`„${title}“ protokolliert`, 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    } finally {
      setIsLogging(false);
    }
  };

  const gpsStatus = error ? 'error' : position ? 'active' : 'searching';

  return (
    <div>
      <div className="cockpit-header">
        <h1 className="page-title">Cockpit</h1>
        <div className="profile-chip" title={`Angemeldet als ${user}`} aria-label={`Angemeldet als ${user}`}>
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="profile-chip-name">{user}</span>
        </div>
      </div>

      {/* Bordinstrument: GPS-Status → Geschwindigkeit → Tracking */}
      <div className="instrument">
        <div className={`instrument-status instrument-status-${gpsStatus}`}>
          <Satellite size={13} />
          <span>{error ?? (position ? 'GPS aktiv' : 'Suche Satelliten …')}</span>
        </div>

        <div className="instrument-speed">
          <span className="instrument-speed-value mono-num">
            {position ? toDisplaySpeed(position.speedKmh, preferences.unitSystem).toFixed(1) : '—'}
          </span>
          <span className="instrument-speed-unit">{speedUnitLabel(preferences.unitSystem)}</span>
        </div>

        <Button
          variant={isTracking ? 'destructive' : 'primary'}
          fullWidth
          onClick={() => setIsTracking(!isTracking)}
        >
          {isTracking ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isTracking ? 'Tour stoppen' : 'Tour starten'}
        </Button>
      </div>

      <h2 className="section-title section-title-spaced">Schnell-Logs</h2>

      {quickLogs.length === 0 ? (
        <EmptyState
          title="Keine Schnell-Logs konfiguriert"
          hint="Unter Mehr → Schnell-Logs Kategorien anlegen."
        />
      ) : (
        <div className="quick-log-grid">
          {quickLogs.map(({ id, label, iconName }) => {
            const Icon = getQuickLogIcon(iconName);
            const isDanger = iconName === 'alert-triangle';
            return (
              <button
                key={id}
                className="quick-log-btn"
                disabled={isLogging || !position}
                onClick={() => handleQuickLog(id, label)}
              >
                <Icon
                  size={22}
                  strokeWidth={1.75}
                  color={isDanger ? 'var(--color-danger)' : 'var(--color-accent)'}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
