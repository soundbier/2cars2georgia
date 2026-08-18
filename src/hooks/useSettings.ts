import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { useT } from '../i18n';
import { DEFAULT_QUICK_LOG_SEEDS, DEFAULT_USERS, QuickLogConfig } from '../types';

/**
 * Abonniert eine Liste aus der settings-Collection des aktuellen Roadtrips
 * und legt sie beim ersten Start mit den Standardwerten an, damit alle
 * Crewmitglieder von Anfang an denselben Stand sehen.
 *
 * `fallback` wird über eine Ref gelesen und geht bewusst nicht in die
 * Effect-Dependencies ein: Seit die Schnell-Log-Vorgaben übersetzt werden,
 * ist der Wert bei jedem Rendern eine neue Liste – als Dependency würde das
 * Abo bei jedem Rendern neu aufgebaut. Ohne angemeldeten Roadtrip (`tripId`
 * null) bleibt es beim Fallback, es wird nichts gelesen oder geschrieben.
 */
function useSettingsList<T>(docId: string, field: string, fallback: T[]) {
  const { tripId } = useRoadtrip();
  const [items, setItems] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);

  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    if (!tripId) {
      setItems(fallbackRef.current);
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
          setItems(fallbackRef.current);
          setDoc(docRef, { [field]: fallbackRef.current }).catch((err) =>
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
  const t = useT();

  // Nur für den allerersten Start relevant: Danach stehen die Beschriftungen
  // als Daten in Firestore und werden nicht mehr aus der Sprache abgeleitet.
  const defaults = useMemo<QuickLogConfig[]>(
    () =>
      DEFAULT_QUICK_LOG_SEEDS.map(({ id, labelKey, iconName }) => ({
        id,
        label: t(labelKey),
        iconName
      })),
    [t]
  );

  return useSettingsList<QuickLogConfig>('quicklogs', 'items', defaults).items;
}

/** Roadtrip-weit synchronisierte Crew-Liste. */
export function useCrew() {
  const { items, loading } = useSettingsList<string>('general', 'users', DEFAULT_USERS);
  return { users: items, loading };
}
