import { useEffect, useRef, useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { GpsPoint } from './types';

export function useTracking(currentUser: string, isTrackingActive: boolean) {
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number; speedKmh: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSavedTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation nicht unterstützt');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const speedMs = position.coords.speed ?? 0;
        const speedKmh = Math.max(0, Math.round(speedMs * 3.6 * 10) / 10);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setCurrentPosition({ lat, lng, speedKmh });

        const now = Date.now();
        if (isTrackingActive && currentUser && now - lastSavedTimestampRef.current >= 30000) {
          lastSavedTimestampRef.current = now;

          const point: GpsPoint = {
            timestamp: now,
            author: currentUser,
            lat,
            lng,
            speedKmh
          };

          addDoc(collection(db, 'track'), point).catch((err) => {
            console.error('GPS-Speicherfehler:', err);
          });
        }
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [currentUser, isTrackingActive]);

  return { currentPosition, error };
}
