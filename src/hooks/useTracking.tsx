import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { usePreferences } from './usePreferences';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { useWakeLock } from './useWakeLock';
import { bearingDegrees, distanceMeters } from '../lib/geo';
import { newSessionId } from '../lib/trackSession';
import {
  BufferedPoint,
  enqueueTrackPoint,
  refreshQueuedCount,
  removeQueuedPoints,
  trackPointId
} from '../lib/trackBuffer';
import { flushTrackBuffer } from '../lib/trackUploader';
import {
  ActiveTrackSession,
  clearActiveSession,
  decideResume,
  readActiveSession,
  writeActiveSession
} from '../lib/activeTrackSession';
import { useT } from '../i18n';
import { Coordinates, GpsPoint, LivePosition } from '../types';

/**
 * Ab dieser Strecke gilt eine Bewegung als gerichtet.
 *
 * Unterhalb davon steckt im Versatz zwischen zwei Fixes fast nur GPS-Rauschen –
 * daraus einen Kurs zu rechnen ließe das Boot im Hafen um sich selbst kreiseln.
 */
const HEADING_MIN_DISTANCE_M = 8;

/** Wie oft der Puffer ohne äußeren Anlass zum Hochladen angestoßen wird. */
const FLUSH_INTERVAL_MS = 30_000;

/** Takt, in dem die Aufsicht prüft, ob der Ortungs-Watcher noch liefert. */
const WATCHDOG_INTERVAL_MS = 15_000;

/**
 * Stille, nach der der Watcher als eingeschlafen gilt.
 *
 * Mobile Browser halten `watchPosition` im Hintergrund an und wecken es nicht
 * zuverlässig wieder auf – genau der Fall, bei dem die Spur nach dem
 * Ausschalten des Bildschirms abriss. Bleiben die Fixes deutlich länger aus,
 * als das eingestellte Intervall erwarten lässt, wird der Watcher neu
 * aufgesetzt.
 */
function watchdogTimeoutMs(trackIntervalMs: number): number {
  return Math.max(60_000, trackIntervalMs * 3);
}

/**
 * Schreibt einen Stapel gepufferter Punkte nach Firestore.
 *
 * Die Dokument-ID ist die Kennung aus dem Puffer und damit aus Aufzeichnung
 * und Zeitstempel abgeleitet: Derselbe Punkt landet auch bei einer
 * Wiederholung auf demselben Dokument statt ein zweites Mal in der Spur
 * (firestore.rules lässt ein wortgleiches Überschreiben deshalb zu).
 */
async function commitBufferedPoints(entries: BufferedPoint[]): Promise<void> {
  const batch = writeBatch(db);
  for (const entry of entries) {
    batch.set(doc(db, tripPath(entry.tripId, 'track'), entry.id), entry.point);
  }
  await batch.commit();
}

/**
 * Eine gerade beendete Aufzeichnung, die noch auf ihren Namen wartet.
 *
 * Die Punkte selbst liegen schon im Puffer bzw. in Firestore – hier steht nur,
 * welche Aufzeichnung das Speichern-Fenster im Cockpit anbieten soll.
 */
export interface FinishedSession {
  id: string;
  startedAt: number;
  endedAt: number;
}

interface TrackingContextValue {
  /** Letzte bekannte Position, unabhängig davon ob eine Tour läuft. */
  position: LivePosition | null;
  error: string | null;
  /** true, solange die Tour aufgezeichnet wird. */
  isTracking: boolean;
  setIsTracking: (value: boolean) => void;
  /**
   * Kennung der laufenden Aufzeichnung – dieselbe, die an jedem Punkt der
   * Spur mitläuft. Damit lässt sich die aktuelle Route aus der Gesamtspur
   * herauslösen (siehe Cockpit). null, solange nichts aufgezeichnet wird.
   */
  activeSessionId: string | null;
  /**
   * Gesetzt vom Stoppen der Tour bis zum Schließen des Speichern-Fensters.
   * Solange sichtbar, kann die Aufzeichnung benannt werden.
   */
  finishedSession: FinishedSession | null;
  /** Schließt das Speichern-Fenster – mit oder ohne vergebenen Namen. */
  dismissFinishedSession: () => void;
  /**
   * true, solange die Tour zwar läuft, aber gerade pausiert ist – z.B. für
   * eine kurze Pause, ohne die Tour komplett zu beenden. Wird beim Stoppen
   * der Tour automatisch zurückgesetzt.
   */
  isPaused: boolean;
  setIsPaused: (value: boolean) => void;
  /**
   * true, solange der Bildschirm für die Aufzeichnung wachgehalten wird –
   * und false, wenn das Gerät das nicht kann oder es abgelehnt hat.
   */
  screenLockHeld: boolean;
  /** false auf Geräten ohne Wake-Lock-API. */
  screenLockSupported: boolean;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

/**
 * Hält genau einen Geolocation-Watcher für die gesamte App.
 *
 * Zuvor startete jede Seite ihren eigenen Watcher mit eigenem Zeitstempel-Ref;
 * beim Wechsel zwischen Cockpit und Karte wurde die Drosselung dadurch
 * zurückgesetzt und es entstanden zusätzliche Trackpunkte.
 *
 * Die Punkte gehen nicht direkt an Firestore, sondern zuerst in den
 * Ausgangspuffer (lib/trackBuffer.ts) und von dort aus hoch. Ohne Netz – und
 * auch nach einem Neustart der App – bleibt die Spur dadurch vollständig.
 */
export function TrackingProvider({ user, children }: { user: string; children: ReactNode }) {
  const { preferences } = usePreferences();
  const { tripId, authUser } = useRoadtrip();
  const t = useT();
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTrackingState] = useState(false);
  const [isPaused, setIsPausedState] = useState(false);
  const [finishedSession, setFinishedSession] = useState<FinishedSession | null>(null);
  // Neben der Ref auch im State, weil die Anzeige davon abhängt: Die Ref
  // allein löst kein Neuzeichnen aus.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Über Refs gelesen, damit das Umschalten der Aufzeichnung den laufenden
  // Watcher nicht neu startet.
  const isTrackingRef = useRef(false);
  const isPausedRef = useRef(false);
  const lastSavedTimestampRef = useRef(0);
  const trackIntervalRef = useRef(preferences.trackIntervalMs);
  // Letzter bekannter Kurs und der Punkt, von dem aus er gemessen wurde.
  const headingRef = useRef<number | null>(null);
  const headingAnchorRef = useRef<Coordinates | null>(null);
  // Die laufende Aufzeichnung. Über eine Ref, weil sie im Watcher-Callback
  // gebraucht wird, der bewusst nicht bei jedem Zustandswechsel neu startet.
  const sessionRef = useRef<ActiveTrackSession | null>(null);
  // Über eine Ref gelesen, damit ein neues User-Objekt (gleiche Person,
  // andere Referenz) den Geolocation-Watcher nicht neu startet.
  const authUidRef = useRef<string | null>(authUser?.uid ?? null);
  authUidRef.current = authUser?.uid ?? null;
  const tripIdRef = useRef<string | null>(tripId);
  tripIdRef.current = tripId;

  // Bildschirm wachhalten, solange wirklich aufgezeichnet wird. In der Pause
  // nicht: Dann steht das Fahrzeug ohnehin.
  const { supported: screenLockSupported, held: screenLockHeld } = useWakeLock(
    preferences.keepScreenAwake && isTracking && !isPaused
  );

  useEffect(() => {
    isTrackingRef.current = isTracking;
    if (!isTracking) {
      lastSavedTimestampRef.current = 0;
      isPausedRef.current = false;
      setIsPausedState(false);
    }
  }, [isTracking]);

  const persistSession = (session: ActiveTrackSession | null) => {
    sessionRef.current = session;
    setActiveSessionId(session?.id ?? null);
    if (session) writeActiveSession(session);
    else clearActiveSession();
  };

  /**
   * Start und Stopp der Tour, inklusive Aufzeichnung.
   *
   * Beim Start bekommt die Tour eine Kennung, die an jedem Punkt mitläuft;
   * beim Stopp wird sie zur `finishedSession` – erst dort bekommt sie einen
   * Namen. Ein zweiter Aufruf mit demselben Wert bleibt wirkungslos, damit ein
   * versehentlicher Doppeltipp auf „Stoppen" nicht ein zweites, leeres
   * Speichern-Fenster öffnet.
   */
  const setIsTracking = (value: boolean) => {
    if (value === isTrackingRef.current) return;
    isTrackingRef.current = value;

    if (value) {
      const startedAt = Date.now();
      persistSession(
        tripId
          ? { id: newSessionId(), startedAt, tripId, paused: false, lastPointAt: startedAt }
          : null
      );
      setFinishedSession(null);
      setIsTrackingState(true);
      return;
    }

    const finished = sessionRef.current;
    persistSession(null);
    setIsTrackingState(false);
    if (finished) {
      setFinishedSession({ id: finished.id, startedAt: finished.startedAt, endedAt: Date.now() });
    }
  };

  const dismissFinishedSession = () => setFinishedSession(null);

  // Pause hält die Aufzeichnung an, ohne die Tour zu beenden – etwa für eine
  // kurze Rast. Nur wirksam, solange die Tour überhaupt läuft.
  const setIsPaused = (value: boolean) => {
    if (!isTrackingRef.current) return;
    isPausedRef.current = value;
    setIsPausedState(value);
    if (sessionRef.current) persistSession({ ...sessionRef.current, paused: value });
  };

  // Ebenfalls per Ref: Ein geändertes Intervall wirkt ab dem nächsten
  // Positionsupdate, ohne den Watcher neu zu starten.
  useEffect(() => {
    trackIntervalRef.current = preferences.trackIntervalMs;
  }, [preferences.trackIntervalMs]);

  /**
   * Eine Aufzeichnung, die beim letzten Mal nicht sauber beendet wurde.
   *
   * Wurde die App im Hintergrund abgeräumt, lief die Tour für die Crew weiter –
   * nur die App wusste nichts mehr davon. Liegt der letzte Punkt kurz zurück,
   * wird sie deshalb mit derselben Kennung fortgesetzt; liegt er Stunden
   * zurück, wird sie zum Benennen angeboten (siehe lib/activeTrackSession.ts).
   */
  useEffect(() => {
    if (!tripId || isTrackingRef.current || sessionRef.current) return;
    const decision = decideResume(readActiveSession(), tripId, Date.now());
    if (decision.kind === 'ignore') return;

    if (decision.kind === 'resume') {
      sessionRef.current = decision.session;
      setActiveSessionId(decision.session.id);
      isTrackingRef.current = true;
      isPausedRef.current = decision.session.paused;
      setIsTrackingState(true);
      setIsPausedState(decision.session.paused);
      return;
    }

    clearActiveSession();
    setFinishedSession({
      id: decision.session.id,
      startedAt: decision.session.startedAt,
      endedAt: decision.session.lastPointAt
    });
  }, [tripId]);

  // Anstoß zum Hochladen des Puffers, aus dem Effekt unten heraus gesetzt.
  const flushRef = useRef<(() => void) | null>(null);
  // Punkte, deren Einzelschreibvorgang gerade noch offen ist. Der Nachschub
  // aus dem Puffer lässt sie in Ruhe, damit derselbe Punkt nicht zweimal geht.
  const inFlightRef = useRef(new Set<string>());
  // Zeitpunkt des letzten Fixes – Grundlage der Watcher-Aufsicht.
  const lastFixAtRef = useRef(0);

  /**
   * Der Puffer wird von außen angestoßen, nicht in einer Schleife geleert.
   *
   * Anlässe: App-Start (auch mit Punkten von gestern), Rückkehr des Netzes,
   * Rückkehr in den Vordergrund, jeder neue Punkt und als Rückfall ein
   * Intervall. Ohne Netz wird gar nicht erst angefangen – die Punkte bleiben
   * liegen, bis es wieder etwas zu senden gibt.
   */
  useEffect(() => {
    const flush = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void flushTrackBuffer(commitBufferedPoints, {
        skip: (entry) => inFlightRef.current.has(entry.id)
      }).catch((err) => {
        console.error('Track-Puffer konnte nicht hochgeladen werden:', err);
      });
    };

    void refreshQueuedCount().then(flush);

    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS);

    flushRef.current = flush;
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      flushRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(t('cockpit.gpsUnsupported'));
      return;
    }

    let watchId: number | null = null;

    /**
     * Der frische Punkt, direkt nach Firestore.
     *
     * Der Umweg über den Puffer allein würde reichen, um ihn irgendwann
     * hochzuladen – aber nicht, um ihn sofort auf der Karte zu zeigen: Die
     * Kartenansicht hängt an den Firestore-Snapshots, und die kennen nur, was
     * durch das SDK gelaufen ist. Offline landet der Schreibvorgang in dessen
     * eigener Warteschlange, ist damit trotzdem sofort in der Ansicht und
     * geht bei Empfang raus.
     *
     * Bestätigt der Server ihn, fällt er aus dem Puffer. Bleibt die
     * Bestätigung aus (App beendet, SDK-Warteschlange verloren), bleibt er
     * liegen und der Nachschub holt ihn beim nächsten Start nach.
     */
    const writeLivePoint = (currentTripId: string, point: GpsPoint) => {
      const id = trackPointId(point);
      inFlightRef.current.add(id);
      setDoc(doc(db, tripPath(currentTripId, 'track'), id), point)
        .then(() => removeQueuedPoints([id]))
        .catch((err) => {
          // Kein Datenverlust: Der Punkt liegt im Puffer und wird erneut
          // versucht.
          console.error('GPS-Speicherfehler:', err);
        })
        .finally(() => {
          inFlightRef.current.delete(id);
          flushRef.current?.();
        });
    };

    const onPosition = ({ coords }: GeolocationPosition) => {
      lastFixAtRef.current = Date.now();
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
      const currentTripId = tripIdRef.current;
      if (!isTrackingRef.current || isPausedRef.current || !user || !currentTripId) return;
      if (now - lastSavedTimestampRef.current < trackIntervalRef.current) return;

      lastSavedTimestampRef.current = now;
      const point: GpsPoint = {
        timestamp: now,
        author: user,
        ...(authUidRef.current ? { authorId: authUidRef.current } : {}),
        ...(sessionRef.current ? { sessionId: sessionRef.current.id } : {}),
        ...next
      };

      // Erst in den Puffer, dann nach Firestore: Der Punkt ist damit
      // gesichert, bevor irgendetwas am Netz hängt.
      if (sessionRef.current) {
        persistSession({ ...sessionRef.current, lastPointAt: now });
      }
      void enqueueTrackPoint(currentTripId, point).then(() => writeLivePoint(currentTripId, point));
    };

    const start = () => {
      if (watchId !== null) return;
      lastFixAtRef.current = Date.now();
      watchId = navigator.geolocation.watchPosition(
        onPosition,
        (err) => {
          // Ein einzelner Timeout beendet die Ortung nicht – der Watcher
          // liefert danach oft von selbst weiter, und die Aufsicht unten
          // setzt ihn neu auf, falls nicht.
          setError(err.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    };

    const stop = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };

    const restart = () => {
      stop();
      start();
    };

    start();

    // Zurück im Vordergrund: Der Watcher wird neu aufgesetzt, statt darauf zu
    // hoffen, dass das Betriebssystem den eingefrorenen wieder anwirft.
    const onVisible = () => {
      if (document.visibilityState === 'visible') restart();
    };
    document.addEventListener('visibilitychange', onVisible);

    const watchdog = window.setInterval(() => {
      if (!isTrackingRef.current || isPausedRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFixAtRef.current < watchdogTimeoutMs(trackIntervalRef.current)) return;
      console.warn('Ortung liefert nichts mehr – Watcher wird neu gestartet.');
      restart();
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(watchdog);
      stop();
    };
  }, [user, t]);

  const value = useMemo(
    () => ({
      position,
      error,
      isTracking,
      setIsTracking,
      activeSessionId,
      isPaused,
      setIsPaused,
      finishedSession,
      dismissFinishedSession,
      screenLockHeld,
      screenLockSupported
    }),
    [
      position,
      error,
      isTracking,
      activeSessionId,
      isPaused,
      finishedSession,
      screenLockHeld,
      screenLockSupported
    ]
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking muss innerhalb von TrackingProvider verwendet werden');
  return ctx;
}
