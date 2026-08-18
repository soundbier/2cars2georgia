import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { DEFAULT_QUICK_LOGS, DEFAULT_USERS, QuickLogConfig } from '../types';

/**
 * Abonniert eine Liste aus der settings-Collection des aktuellen Roadtrips
 * und legt sie beim ersten Start mit den Standardwerten an, damit alle
 * Crewmitglieder von Anfang an denselben Stand sehen.
 *
 * `fallback` muss eine Modul-Konstante sein – der Wert geht bewusst nicht in
 * die Effect-Dependencies ein. Ohne angemeldeten Roadtrip (`tripId` null)
 * bleibt es beim Fallback, es wird nichts gelesen oder geschrieben.
 */
function useSettingsList<T>(docId: string, field: string, fallback: T[]) {
  const { tripId } = useRoadtrip();
  const [items, setItems] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setItems(fallback);
      setLoading(false);
      return;
    }
    const docRef = doc(db, tripPath(tripId, 'settings', docId));
    return onSnapshot(
      docRef,
      (docSnap) => {
        const stored = docSnap.exists() ? (docSnap.data()[field] as T[] | undefined) : undefined;
        if (stored && stored.length > 0) {
          setItems(stored);
        } else {
          setItems(fallback);
          setDoc(docRef, { [field]: fallback }).catch((err) =>
            console.error(`settings/${docId} konnte nicht angelegt werden:`, err)
          );
        }
        setLoading(false);
      },
      (err) => {
        console.error(`Firestore-Fehler (settings/${docId}):`, err);
        setLoading(false);
      }
    );
  }, [tripId, docId, field]);

  return { items, loading };
}

/** Roadtrip-weit synchronisierte Schnell-Log-Kategorien. */
export function useQuickLogs(): QuickLogConfig[] {
  return useSettingsList<QuickLogConfig>('quicklogs', 'items', DEFAULT_QUICK_LOGS).items;
}

/** Roadtrip-weit synchronisierte Crew-Liste. */
export function useCrew() {
  const { items, loading } = useSettingsList<string>('general', 'users', DEFAULT_USERS);
  return { users: items, loading };
}
