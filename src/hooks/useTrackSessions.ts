import { useCallback, useMemo } from 'react';
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './useCollection';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { usePermissions } from './usePermissions';
import { trackWrite } from '../lib/pendingWrites';
import { SESSION_NAME_MAX_LENGTH } from '../lib/trackSession';
import { activeOnly } from '../lib/trash';
import { TrackSession } from '../types';

/**
 * Die benannten Aufzeichnungen des Roadtrips.
 *
 * Geschrieben wurden sie bisher nur einmal – beim Stoppen der Tour (siehe
 * components/TrackSessionDialog.tsx) – und danach von keiner Seite mehr
 * gelesen. Damit war ein vertippter Name für immer vertippt. Dieser Hook
 * holt die Liste zurück in die Oberfläche (pages/RoutePlanner.tsx).
 *
 * Was hier änderbar ist, ist ausschließlich der Name: Start, Ende und
 * Autor beschreiben die gefahrene Strecke und sind keine Beschriftung.
 * firestore.rules setzt genau das durch.
 *
 * Löschen legt die Fahrt in den Papierkorb, statt sie sofort zu entfernen –
 * dieselbe Aufbewahrung wie bei Logbuch und Reisekasse (lib/trash.ts). Die
 * Trackpunkte selbst bleiben in jedem Fall liegen: Sie sind Teil der
 * durchgehenden Spur, der Eintrag hier ist nur ihre Beschriftung.
 */

const COLLECTION = 'trackSessions';

export interface TrackSessionsState {
  /** Aufzeichnungen des Roadtrips, die zuletzt gefahrene zuerst. */
  sessions: TrackSession[];
  /** false für Read-only: nichts umbenennen, nichts löschen. */
  canEdit: boolean;
  /** Legt die Fahrt in den Papierkorb – die Trackpunkte selbst bleiben liegen. */
  remove: (session: TrackSession) => Promise<boolean>;
  /** Holt sie von dort zurück – der Weg des Rückgängig-Toasts. */
  restore: (sessionId: string) => Promise<boolean>;
  /** Benennt die Aufzeichnung um; false, wenn der Server sie nicht annimmt. */
  rename: (session: TrackSession, name: string) => Promise<boolean>;
}

export function useTrackSessions(): TrackSessionsState {
  const { tripId } = useRoadtrip();
  const { canEdit } = usePermissions();
  const stored = useCollection<TrackSession>(
    tripId ? tripPath(tripId, COLLECTION) : null,
    'startedAt',
    'desc'
  );
  // Im Papierkorb liegende Fahrten sind aus der Liste heraus – zu sehen sind
  // sie nur noch unter Einstellungen → Papierkorb.
  const sessions = useMemo(() => activeOnly(stored), [stored]);

  const rename = useCallback(
    async (session: TrackSession, name: string) => {
      const trimmed = name.trim().slice(0, SESSION_NAME_MAX_LENGTH);
      if (!tripId || !canEdit || !session.id || !trimmed) return false;
      // Vollständig geschrieben statt zusammengeführt: firestore.rules prüft
      // das Dokument als Ganzes, und die übrigen Felder sollen dabei
      // unverändert wieder ankommen – auch die authorId der Person, die
      // gefahren ist, wenn jemand anderes den Namen richtigstellt.
      const entry: TrackSession = {
        name: trimmed,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        author: session.author,
        ...(session.authorId ? { authorId: session.authorId } : {}),
        ...(typeof session.deletedAt === 'number' ? { deletedAt: session.deletedAt } : {})
      };
      try {
        await trackWrite(setDoc(doc(db, tripPath(tripId, COLLECTION, session.id)), entry));
        return true;
      } catch (err) {
        console.error('Aufzeichnung konnte nicht umbenannt werden:', err);
        return false;
      }
    },
    [canEdit, tripId]
  );

  // Weiches Löschen wie bei Logbuch und Reisekasse: Der Eintrag verschwindet
  // aus der Liste, liegt aber noch im Papierkorb (siehe lib/trash.ts).
  // Endgültig entfernen darf ihn nur der Owner – das setzt firestore.rules
  // durch, hier reicht Schreibrecht.
  const remove = useCallback(
    async (session: TrackSession) => {
      if (!tripId || !canEdit || !session.id) return false;
      try {
        await trackWrite(
          updateDoc(doc(db, tripPath(tripId, COLLECTION, session.id)), { deletedAt: Date.now() })
        );
        return true;
      } catch (err) {
        console.error('Aufzeichnung konnte nicht gelöscht werden:', err);
        return false;
      }
    },
    [canEdit, tripId]
  );

  const restore = useCallback(
    async (sessionId: string) => {
      if (!tripId || !canEdit) return false;
      try {
        await trackWrite(
          updateDoc(doc(db, tripPath(tripId, COLLECTION, sessionId)), { deletedAt: deleteField() })
        );
        return true;
      } catch (err) {
        console.error('Aufzeichnung konnte nicht wiederhergestellt werden:', err);
        return false;
      }
    },
    [canEdit, tripId]
  );

  return { sessions, canEdit, remove, restore, rename };
}
