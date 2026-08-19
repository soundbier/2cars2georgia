import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { useT } from '../i18n';
import { DEFAULT_QUICK_LOG_SEEDS, CrewRole, QuickLogConfig } from '../types';

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

/** Ein Crewmitglied, wie unter roadtrips/{tripId}/members/{uid} gespeichert. */
export interface CrewMember {
  uid: string;
  displayName: string;
  role: CrewRole;
}

/**
 * Roadtrip-weite Crew-Liste inklusive Rollen, gelesen aus der
 * Mitgliedschafts-Collection `roadtrips/{tripId}/members` (siehe
 * lib/membership.ts und firestore.rules). Jedes Mitglied ist eine echte
 * Firebase-UID mit einer direkt am Dokument gespeicherten Rolle – anders als
 * früher gibt es keine implizite Owner-Herleitung mehr, die Rolle steht
 * immer explizit.
 *
 * `users` bleibt zusätzlich als reine Namensliste erhalten, weil mehrere
 * Seiten (Bordkasse-Abrechnung, Export) nur die Anzeigenamen brauchen.
 */
export function useCrew() {
  const { tripId } = useRoadtrip();
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    return onSnapshot(
      collection(db, tripPath(tripId, 'members')),
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({
            uid: d.id,
            displayName: (d.data().displayName as string | undefined) ?? d.id,
            role: (d.data().role as CrewRole | undefined) ?? 'member'
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('Firestore-Fehler (members):', err);
        setLoading(false);
      }
    );
  }, [tripId]);

  const users = useMemo(() => members.map((m) => m.displayName), [members]);

  return { members, users, loading };
}

/**
 * Reisezeitraum des Roadtrips (settings/general, Felder "startDate" und
 * "endDate", je 'YYYY-MM-DD'). Beide fehlen bei Roadtrips, die vor dieser
 * Funktion angelegt wurden – kein Fehlerfall, der Speiseplan zeigt dann
 * einen Hinweis zum Nachtragen statt eines Kalenders, und das Cockpit lässt
 * "Tag X von Y" schlicht weg.
 */
export function useTripDates(): { startDate?: string; endDate?: string; loading: boolean } {
  const { tripId } = useRoadtrip();
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setStartDate(undefined);
      setEndDate(undefined);
      setLoading(false);
      return;
    }
    const docRef = doc(db, tripPath(tripId, 'settings', 'general'));
    return onSnapshot(
      docRef,
      (docSnap) => {
        const data = docSnap.exists() ? docSnap.data() : undefined;
        setStartDate(data?.startDate as string | undefined);
        setEndDate(data?.endDate as string | undefined);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore-Fehler (settings/general):', err);
        setLoading(false);
      }
    );
  }, [tripId]);

  return { startDate, endDate, loading };
}
