import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usePreferences } from './usePreferences';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { trackWrite } from '../lib/pendingWrites';
import { bearingDegrees, distanceMeters } from '../lib/geo';
import { Coordinates, GpsPoint, LivePosition } from '../types';

/**
 * Ab dieser Strecke gilt eine Bewegung als gerichtet.
 *
 * Unterhalb davon steckt im Versatz zwischen zwei Fixes fast nur GPS-Rauschen –
 * daraus einen Kurs zu rechnen ließe das Boot im Hafen um sich selbst kreiseln.
 */
const HEADING_MIN_DISTANCE_M = 8;

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
  const { tripId } = useRoadtrip();
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Über Refs gelesen, damit das Umschalten der Aufzeichnung den laufenden
  // Watcher nicht neu startet.
  const isTrackingRef = useRef(false);
  const lastSavedTimestampRef = useRef(0);
  const trackIntervalRef = useRef(preferences.trackIntervalMs);
  // Letzter bekannter Kurs und der Punkt, von dem aus er gemessen wurde.
  const headingRef = useRef<number | null>(null);
  const headingAnchorRef = useRef<Coordinates | null>(null);

  useEffect(() => {
    isTrackingRef.current = isTracking;
    if (!isTracking) lastSavedTimestampRef.current = 0;
  }, [isTracking]);

  /**
   * Zustand der Aufzeichnung, wie ihn der Notfall-Wächter in den Cloud
   * Functions sieht (functions/src/index.ts, checkStalledTracking). Ohne
   * dieses Dokument kann serverseitig niemand unterscheiden, ob keine
   * Positionen ankommen, weil die Tour beendet wurde, oder weil an Bord etwas
   * nicht stimmt.
   */
  const writeTrackingState = useRef<(active: boolean, lastPointAt: number) => void>(() => {});
  writeTrackingState.current = (active, lastPointAt) => {
    if (!user || !tripId) return;
    trackWrite(
      setDoc(doc(db, tripPath(tripId, 'tracking'), user), { user, active, lastPointAt })
    ).catch((err) => console.error('Aufzeichnungsstatus konnte nicht gemeldet werden:', err));
  };

  useEffect(() => {
    // Beim Start zählt der aktuelle Zeitpunkt als "zuletzt gesehen", sonst
    // schlüge der Wächter sofort an, falls der erste Fix auf sich warten lässt.
    writeTrackingState.current(isTracking, Date.now());
  }, [isTracking, user, tripId]);

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
        const here: Coordinates = { lat: coords.latitude, lng: coords.longitude };

        // Der Kompass des Geräts liefert den Kurs nur unterwegs – im Stand und
        // auf Geräten ohne Sensor ist er NaN oder null. Dann leiten wir ihn aus
        // der zurückgelegten Strecke ab. Der Ankerpunkt rückt erst nach, wenn
        // die Schwelle erreicht ist, damit auch langsame Fahrt einen Kurs ergibt.
        const anchor = headingAnchorRef.current;
        if (coords.heading !== null && Number.isFinite(coords.heading)) {
          headingRef.current = coords.heading;
          headingAnchorRef.current = here;
        } else if (!anchor) {
          headingAnchorRef.current = here;
        } else if (distanceMeters(anchor, here) >= HEADING_MIN_DISTANCE_M) {
          headingRef.current = bearingDegrees(anchor, here);
          headingAnchorRef.current = here;
        }

        const next: LivePosition = {
          ...here,
          speedKmh: Math.max(0, Math.round((coords.speed ?? 0) * 3.6 * 10) / 10),
          headingDeg: headingRef.current === null ? null : Math.round(headingRef.current)
        };
        setPosition(next);
        setError(null);

        const now = Date.now();
        if (!isTrackingRef.current || !user || !tripId) return;
        if (now - lastSavedTimestampRef.current < trackIntervalRef.current) return;

        lastSavedTimestampRef.current = now;
        const point: GpsPoint = { timestamp: now, author: user, ...next };
        trackWrite(addDoc(collection(db, tripPath(tripId, 'track')), point)).catch((err) => {
          console.error('GPS-Speicherfehler:', err);
        });
        // Im selben Takt wie die Trackpunkte, nicht bei jedem GPS-Fix: Der
        // Heartbeat soll die Schreiblast nicht vervielfachen.
        writeTrackingState.current(true, now);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, tripId]);

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
