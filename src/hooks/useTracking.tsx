import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usePreferences } from './usePreferences';
import { GpsPoint, LivePosition } from '../types';

interface TrackingContextValue {
  /** Letzte bekannte Position, unabhängig davon ob eine Tour läuft. */
  position: LivePosition | null;
  error: string | null;
  /** true, solange die Tour aufgezeichnet wird. */
  isTracking: boolean;
  setIsTracking: (value: boolean) => void;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

/**
 * Hält genau einen Geolocation-Watcher für die gesamte App.
 *
 * Zuvor startete jede Seite ihren eigenen Watcher mit eigenem Zeitstempel-Ref;
 * beim Wechsel zwischen Cockpit und Karte wurde die Drosselung dadurch
 * zurückgesetzt und es entstanden zusätzliche Trackpunkte.
 */
export function TrackingProvider({ user, children }: { user: string; children: ReactNode }) {
  const { preferences } = usePreferences();
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Über Refs gelesen, damit das Umschalten der Aufzeichnung den laufenden
  // Watcher nicht neu startet.
  const isTrackingRef = useRef(false);
  const lastSavedTimestampRef = useRef(0);
  const trackIntervalRef = useRef(preferences.trackIntervalMs);

  useEffect(() => {
    isTrackingRef.current = isTracking;
    if (!isTracking) lastSavedTimestampRef.current = 0;
  }, [isTracking]);

  // Ebenfalls per Ref: Ein geändertes Intervall wirkt ab dem nächsten
  // Positionsupdate, ohne den Watcher neu zu starten.
  useEffect(() => {
    trackIntervalRef.current = preferences.trackIntervalMs;
  }, [preferences.trackIntervalMs]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation nicht unterstützt');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const next: LivePosition = {
          lat: coords.latitude,
          lng: coords.longitude,
          speedKmh: Math.max(0, Math.round((coords.speed ?? 0) * 3.6 * 10) / 10)
        };
        setPosition(next);
        setError(null);

        const now = Date.now();
        if (!isTrackingRef.current || !user) return;
        if (now - lastSavedTimestampRef.current < trackIntervalRef.current) return;

        lastSavedTimestampRef.current = now;
        const point: GpsPoint = { timestamp: now, author: user, ...next };
        addDoc(collection(db, 'track'), point).catch((err) => {
          console.error('GPS-Speicherfehler:', err);
        });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);

  const value = useMemo(
    () => ({ position, error, isTracking, setIsTracking }),
    [position, error, isTracking]
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking muss innerhalb von TrackingProvider verwendet werden');
  return ctx;
}
