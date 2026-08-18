import { CloudUpload } from 'lucide-react';
import { usePendingWrites } from '../hooks/usePendingWrites';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './SyncStatusBanner.css';

/**
 * Sichtbares Gegenstück zum stillen Offline-Cache: Firestore queued
 * Schreibvorgänge bei Verbindungsverlust selbstständig, aber ohne dieses
 * Banner sah man das nirgends – Einträge wirkten gespeichert, obwohl sie nur
 * lokal lagen. App-weit über der Bottom-Nav platziert, damit es auf jeder
 * Seite sichtbar ist, während etwas offen ist.
 */
export function SyncStatusBanner() {
  const pending = usePendingWrites();
  const isOnline = useOnlineStatus();

  if (pending === 0) return null;

  return (
    <div className="sync-status-banner" role="status">
      <CloudUpload size={15} className={isOnline ? 'sync-status-spin' : undefined} />
      <span>
        {isOnline
          ? `Wird synchronisiert … (${pending})`
          : `Offline gespeichert, wird bei Empfang synchronisiert (${pending})`}
      </span>
    </div>
  );
}
