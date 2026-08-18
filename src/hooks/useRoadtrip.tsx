import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { tripIdFromUser } from '../lib/roadtrip';

interface RoadtripContextValue {
  /** true, solange der Auth-Status noch nicht bekannt ist (erster Start). */
  loading: boolean;
  /** ID des angemeldeten Roadtrips, oder null solange niemand angemeldet ist. */
  tripId: string | null;
  /** Anzeigename des Roadtrips, fällt auf die ID zurück solange er noch lädt. */
  tripName: string | null;
}

const RoadtripContext = createContext<RoadtripContextValue | null>(null);

/**
 * Hält den Firebase-Auth-Status des Geräts (= "in welchem Roadtrip bin ich
 * angemeldet") und stellt ihn app-weit bereit. Alle Firestore-Pfade der
 * anderen Hooks/Seiten hängen von `tripId` ab – ohne Anmeldung existiert
 * schlicht kein Pfad, unter dem gelesen/geschrieben werden könnte.
 */
export function RoadtripProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripName, setTripName] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setTripId(tripIdFromUser(user));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!tripId) {
      setTripName(null);
      return;
    }
    return onSnapshot(doc(db, 'roadtrips', tripId), (snap) => {
      setTripName((snap.exists() ? (snap.data().name as string | undefined) : undefined) ?? tripId);
    });
  }, [tripId]);

  const value = useMemo(() => ({ loading, tripId, tripName }), [loading, tripId, tripName]);

  return <RoadtripContext.Provider value={value}>{children}</RoadtripContext.Provider>;
}

export function useRoadtrip() {
  const ctx = useContext(RoadtripContext);
  if (!ctx) throw new Error('useRoadtrip muss innerhalb von RoadtripProvider verwendet werden');
  return ctx;
}

/** Firestore-Pfad einer Collection innerhalb des aktuell angemeldeten Roadtrips. */
export function tripPath(tripId: string, ...segments: string[]): string {
  return ['roadtrips', tripId, ...segments].join('/');
}
