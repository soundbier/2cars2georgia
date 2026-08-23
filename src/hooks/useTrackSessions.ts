import { useCallback } from 'react';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './useCollection';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { usePermissions } from './usePermissions';
import { trackWrite } from '../lib/pendingWrites';
import { SESSION_NAME_MAX_LENGTH } from '../lib/trackSession';
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
 */

const COLLECTION = 'trackSessions';

export interface TrackSessionsState {
  /** Aufzeichnungen des Roadtrips, die zuletzt gefahrene zuerst. */
  sessions: TrackSession[];
  /** false für Read-only: nichts umbenennen. */
  canEdit: boolean;
  /** Endgültiges Löschen bleibt dem Owner vorbehalten, wie bei den Punkten. */
  canDelete: boolean;
  /** Benennt die Aufzeichnung um; false, wenn der Server sie nicht annimmt. */
  rename: (session: TrackSession, name: string) => Promise<boolean>;
  /** Entfernt den Namen der Fahrt – die Trackpunkte selbst bleiben liegen. */
  remove: (session: TrackSession) => Promise<boolean>;
}

export function useTrackSessions(): TrackSessionsState {
  const { tripId } = useRoadtrip();
  const { canEdit, isOwner } = usePermissions();
  const sessions = useCollection<TrackSession>(
    tripId ? tripPath(tripId, COLLECTION) : null,
    'startedAt',
    'desc'
  );

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
        ...(session.authorId ? { authorId: session.authorId } : {})
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

  const remove = useCallback(
    async (session: TrackSession) => {
      if (!tripId || !isOwner || !session.id) return false;
      try {
        await trackWrite(deleteDoc(doc(db, tripPath(tripId, COLLECTION, session.id))));
        return true;
      } catch (err) {
        console.error('Aufzeichnung konnte nicht gelöscht werden:', err);
        return false;
      }
    },
    [isOwner, tripId]
  );

  return { sessions, canEdit, canDelete: isOwner, rename, remove };
}
