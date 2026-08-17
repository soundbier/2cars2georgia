import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_QUICK_LOGS, DEFAULT_USERS, QuickLogConfig } from '../types';

/**
 * Abonniert eine Liste aus der settings-Collection und legt sie beim ersten
 * Start mit den Standardwerten an, damit alle Crewmitglieder von Anfang an
 * denselben Stand sehen.
 *
 * `fallback` muss eine Modul-Konstante sein – der Wert geht bewusst nicht in
 * die Effect-Dependencies ein.
 */
function useSettingsList<T>(docId: string, field: string, fallback: T[]) {
  const [items, setItems] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', docId);
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
  }, [docId, field]);

  return { items, loading };
}

/** App-weit synchronisierte Schnell-Log-Kategorien. */
export function useQuickLogs(): QuickLogConfig[] {
  return useSettingsList<QuickLogConfig>('quicklogs', 'items', DEFAULT_QUICK_LOGS).items;
}

/** App-weit synchronisierte Crew-Liste. */
export function useCrew() {
  const { items, loading } = useSettingsList<string>('general', 'users', DEFAULT_USERS);
  return { users: items, loading };
}
