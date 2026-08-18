import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { Play, Pause, Square, Satellite } from 'lucide-react';
import { db } from '../firebase';
import { useTracking } from '../hooks/useTracking';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { trackWrite } from '../lib/pendingWrites';
import { useQuickLogs } from '../hooks/useSettings';
import { usePreferences } from '../hooks/usePreferences';
import { getQuickLogIcon } from '../lib/quickLogIcons';
import { speedUnitLabel, toDisplaySpeed } from '../lib/units';
import { LogType, LogEvent } from '../types';
import { useT } from '../i18n';
import { Button, EmptyState, useToast } from '../components/ui';
import './Dashboard.css';

export default function Dashboard({ user }: { user: string }) {
  const { position, error, isTracking, setIsTracking, isPaused, setIsPaused } = useTracking();
  const { tripId } = useRoadtrip();
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const [isLogging, setIsLogging] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const handleQuickLog = async (type: LogType, title: string) => {
    if (!position) {
      notify(t('cockpit.waitingForGps'), 'danger');
      return;
    }
    if (!tripId) return;
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
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'events')), event));
      notify(t('cockpit.logged', { title }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    } finally {
      setIsLogging(false);
    }
  };

  const gpsStatus = error ? 'error' : position ? 'active' : 'searching';

  return (
    <div>
      <div className="cockpit-header">
        <h1 className="page-title">{t('cockpit.title')}</h1>
        <div
          className="profile-chip"
          title={t('cockpit.signedInAs', { name: user })}
          aria-label={t('cockpit.signedInAs', { name: user })}
        >
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="profile-chip-name">{user}</span>
        </div>
      </div>

      {/* Bordinstrument: GPS-Status → Geschwindigkeit → Tracking */}
      <div className="instrument">
        <div className={`instrument-status instrument-status-${isTracking && isPaused ? 'paused' : gpsStatus}`}>
          <Satellite size={13} />
          <span>
            {isTracking && isPaused
              ? t('cockpit.tourPaused')
              : (error ?? (position ? t('cockpit.gpsActive') : t('cockpit.gpsSearching')))}
          </span>
        </div>

        <div className="instrument-speed">
          <span className="instrument-speed-value mono-num">
            {position ? toDisplaySpeed(position.speedKmh, preferences.unitSystem).toFixed(1) : '—'}
          </span>
          <span className="instrument-speed-unit">{speedUnitLabel(preferences.unitSystem)}</span>
        </div>

        {isTracking ? (
          <div className="instrument-actions">
            <Button variant="secondary" fullWidth onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? (
                <Play size={18} fill="currentColor" />
              ) : (
                <Pause size={18} fill="currentColor" />
              )}
              {isPaused ? t('cockpit.resumeTour') : t('cockpit.pauseTour')}
            </Button>
            <Button variant="destructive" fullWidth onClick={() => setIsTracking(false)}>
              <Square size={18} fill="currentColor" />
              {t('cockpit.stopTour')}
            </Button>
          </div>
        ) : (
          <Button variant="primary" fullWidth onClick={() => setIsTracking(true)}>
            <Play size={18} fill="currentColor" />
            {t('cockpit.startTour')}
          </Button>
        )}
      </div>

      <h2 className="section-title section-title-spaced">{t('cockpit.quickLogs')}</h2>

      {quickLogs.length === 0 ? (
        <EmptyState
          title={t('cockpit.noQuickLogs')}
          hint={t('cockpit.noQuickLogsHint')}
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
