import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { CrewRole } from '../types';

const STORAGE_KEY_TRIP_ID = 'active_trip_id';

interface RoadtripContextValue {
  /** true, solange der Auth-Status noch nicht bekannt ist (erster Start). */
  authLoading: boolean;
  /** Firebase-Auth-User dieses Geräts, oder null ohne Anmeldung. */
  authUser: User | null;
  /** true, solange Auth-Status oder (bei vorhandenem User) das Profil noch nicht bekannt sind. */
  loading: boolean;
  /** Anzeigename aus users/{uid}, oder null solange noch kein Profil angelegt wurde. */
  displayName: string | null;
  /**
   * Plattform-Administration: users/{uid}.role == 'admin'. Wird ausschließlich
   * direkt in Firebase gesetzt, nie von der App geschrieben. Maßgeblich ist
   * auch hier firestore.rules (isPlatformAdmin) – die Oberfläche blendet damit
   * nur den Menüpunkt "Administration" ein.
   */
  isPlatformAdmin: boolean;
  /** ID des aktuell ausgewählten Roadtrips, oder null solange keiner aktiv ist. */
  tripId: string | null;
  /** Anzeigename des Roadtrips, fällt auf die ID zurück solange er noch lädt. */
  tripName: string | null;
  /** Rolle der angemeldeten Person in diesem Roadtrip, siehe lib/permissions.ts. */
  role: CrewRole | null;
  /**
   * Owner-Rolle in diesem Roadtrip? Entscheidend ist die gleichnamige Prüfung
   * in firestore.rules – hier steht sie nur, damit die Oberfläche nicht
   * Aktionen anbietet, die der Server ablehnen würde.
   */
  isAdmin: boolean;
  /** Wählt einen Roadtrip als aktiv aus (nach Erstellen oder Beitreten). */
  selectTrip: (tripId: string) => void;
  /** Verlässt den aktuell ausgewählten Roadtrip auf diesem Gerät (Mitgliedschaft bleibt bestehen). */
  clearTrip: () => void;
}

const RoadtripContext = createContext<RoadtripContextValue | null>(null);

/**
 * Hält den Firebase-Auth-Status, das Profil (users/{uid}) und die
 * Mitgliedschaft im aktuell ausgewählten Roadtrip und stellt beides app-weit
 * bereit. Alle Firestore-Pfade der anderen Hooks/Seiten hängen von `tripId`
 * ab – ohne bestätigte Mitgliedschaft (roadtrips/{tripId}/members/{uid})
 * lässt firestore.rules dort nichts lesen oder schreiben.
 */
export function RoadtripProvider({ children }: { children: ReactNode }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [tripId, setTripId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TRIP_ID));
  const [tripName, setTripName] = useState<string | null>(null);
  const [role, setRole] = useState<CrewRole | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!authUser) {
      setDisplayName(null);
      setIsPlatformAdmin(false);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    return onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        setDisplayName(snap.exists() ? ((snap.data().displayName as string | undefined) ?? null) : null);
        setIsPlatformAdmin(snap.exists() && snap.data().role === 'admin');
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
  }, [authUser]);

  // Mitgliedschaft im aktiven Roadtrip: existiert kein Dokument (mehr) für
  // diese UID – sei es weil nie beigetreten oder weil entfernt – gilt der
  // Roadtrip als nicht mehr aktiv und die Auswahl wird zurückgesetzt.
  useEffect(() => {
    if (!authUser || !tripId) {
      setRole(null);
      setMembershipLoading(false);
      return;
    }
    setMembershipLoading(true);
    return onSnapshot(
      doc(db, 'roadtrips', tripId, 'members', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setRole((snap.data().role as CrewRole | undefined) ?? 'member');
        } else {
          setRole(null);
          setTripId(null);
          localStorage.removeItem(STORAGE_KEY_TRIP_ID);
        }
        setMembershipLoading(false);
      },
      () => setMembershipLoading(false)
    );
  }, [authUser, tripId]);

  useEffect(() => {
    if (!tripId) {
      setTripName(null);
      return;
    }
    return onSnapshot(doc(db, 'roadtrips', tripId), (snap) => {
      setTripName((snap.exists() ? (snap.data().name as string | undefined) : undefined) ?? tripId);
    });
  }, [tripId]);

  const selectTrip = (id: string) => {
    localStorage.setItem(STORAGE_KEY_TRIP_ID, id);
    setTripId(id);
  };

  const clearTrip = () => {
    localStorage.removeItem(STORAGE_KEY_TRIP_ID);
    setTripId(null);
  };

  const loading = authLoading || (authUser != null && (profileLoading || (tripId != null && membershipLoading)));

  const value = useMemo(
    () => ({
      authLoading,
      authUser,
      loading,
      displayName,
      isPlatformAdmin,
      tripId: role ? tripId : null,
      tripName: role ? tripName : null,
      role,
      isAdmin: role === 'owner',
      selectTrip,
      clearTrip
    }),
    [authLoading, authUser, loading, displayName, isPlatformAdmin, tripId, tripName, role]
  );

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
