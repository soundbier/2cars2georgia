import { useEffect, useState } from 'react';

/**
 * Hält den Bildschirm an, solange aufgezeichnet wird.
 *
 * Der Browser hat keinen Hintergrund-Standortdienst: Geht der Bildschirm aus,
 * friert das Betriebssystem die Seite ein und `watchPosition` liefert nichts
 * mehr – die Fahrt steht als Lücke in der Spur. Die Wake-Lock-API ist das
 * einzige Mittel, das eine Web-App dagegen hat, und deshalb während der
 * Aufzeichnung aktiv (abschaltbar in den Einstellungen, denn sie kostet
 * Akku).
 *
 * Die Sperre geht verloren, sobald die Seite in den Hintergrund gerät – das
 * ist so vorgesehen. Kommt sie zurück, wird sie neu angefordert.
 */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const [held, setHeld] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!supported || !active) {
      setHeld(false);
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const release = () => {
      const held = sentinel;
      sentinel = null;
      setHeld(false);
      held?.release().catch(() => {
        // Beim Freigeben einer bereits verlorenen Sperre – nichts zu tun.
      });
    };

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          next.release().catch(() => undefined);
          return;
        }
        sentinel = next;
        setHeld(true);
        next.addEventListener('release', () => {
          if (sentinel === next) {
            sentinel = null;
            setHeld(false);
          }
        });
      } catch (err) {
        // Vom Browser abgelehnt (Akkusparmodus, fehlende Nutzergeste): Die
        // Aufzeichnung läuft trotzdem weiter, nur eben ohne Bildschirmsperre.
        console.warn('Bildschirmsperre nicht möglich:', err);
        setHeld(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active, supported]);

  return { supported, held };
}
