import { useEffect } from 'react';
import { CloudUpload } from 'lucide-react';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { useQueuedTrackPoints } from '../hooks/useQueuedTrackPoints';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useT } from '../i18n';
import './SyncStatusBanner.css';

/**
 * Sichtbares Gegenstück zum stillen Offline-Cache: Firestore queued
 * Schreibvorgänge bei Verbindungsverlust selbstständig, aber ohne dieses
 * Banner sah man das nirgends – Einträge wirkten gespeichert, obwohl sie nur
 * lokal lagen. App-weit über der Bottom-Nav platziert, damit es auf jeder
 * Seite sichtbar ist, während etwas offen ist.
 *
 * Solange es steht, bekommt <body> die Klasse `has-sync-banner`: Die Toasts
 * liegen an derselben Bildschirmkante und haben das Banner vorher verdeckt –
 * ausgerechnet die Meldung, dass noch etwas ungesichert ist.
 */
export function SyncStatusBanner() {
  const pendingWrites = usePendingWrites();
  const queuedPoints = useQueuedTrackPoints();
  const isOnline = useOnlineStatus();
  const t = useT();

  // Zwei Quellen, eine Aussage: laufende Firestore-Schreibvorgänge dieser
  // Sitzung und Trackpunkte, die noch im Ausgangspuffer liegen – letztere
  // auch dann, wenn sie aus einer früheren Sitzung stammen.
  const pending = pendingWrites + queuedPoints;
  const visible = pending > 0;

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('has-sync-banner');
    return () => document.body.classList.remove('has-sync-banner');
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="sync-status-banner" role="status">
      <CloudUpload size={15} className={isOnline ? 'sync-status-spin' : undefined} />
      <span>
        {isOnline
          ? t('sync.syncing', { count: pending })
          : t('sync.offlineQueued', { count: pending })}
        {queuedPoints > 0 && ` · ${t('sync.trackPointsQueued', { count: queuedPoints })}`}
      </span>
    </div>
  );
}
