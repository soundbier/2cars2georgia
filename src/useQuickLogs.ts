import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { QuickLogConfig, DEFAULT_QUICK_LOGS } from './types';

/**
 * Liest die app-weit über Firebase synchronisierte Liste der Schnell-Logs.
 * Fehlt das Dokument noch (erster Start), wird die Standardliste einmalig
 * angelegt, damit alle Crewmitglieder von Anfang an dieselben Kategorien sehen.
 */
export function useQuickLogs() {
  const [quickLogs, setQuickLogs] = useState<QuickLogConfig[]>(DEFAULT_QUICK_LOGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'quicklogs');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      const items = docSnap.exists() ? (docSnap.data().items as QuickLogConfig[] | undefined) : undefined;
      if (items && items.length > 0) {
        setQuickLogs(items);
      } else {
        setDoc(docRef, { items: DEFAULT_QUICK_LOGS });
        setQuickLogs(DEFAULT_QUICK_LOGS);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { quickLogs, loading };
}
