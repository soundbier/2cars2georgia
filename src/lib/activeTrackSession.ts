/**
 * Die laufende Aufzeichnung, über den App-Neustart hinweg.
 *
 * „Läuft gerade eine Tour?" stand bisher nur im React-State. Wird die App vom
 * Betriebssystem beendet – Bildschirm aus, anderes Programm im Vordergrund,
 * Akku leer –, war die Aufzeichnung nach dem Öffnen still beendet: Die Punkte
 * davor gehörten zu einer Aufzeichnung, die niemand mehr fortsetzen konnte.
 *
 * Deshalb steht sie jetzt in localStorage: dieselbe Kennung, dieselbe
 * Startzeit, derselbe Pausenzustand. Beim nächsten Start läuft die Tour
 * weiter, und die Spur bleibt eine einzige Aufzeichnung statt zweier
 * Bruchstücke.
 *
 * localStorage statt Firestore, weil es eine Aussage über dieses Gerät ist
 * (dieses Handy zeichnet auf) und ohne Netz sofort lesbar sein muss.
 */

const STORAGE_KEY = 'boat_active_track_session';

/**
 * Ab dieser Lücke wird nicht mehr fortgesetzt.
 *
 * Kommt die App nach einer kurzen Unterbrechung zurück, ist Weiterfahren das
 * Richtige. Liegt der letzte Punkt aber Stunden zurück, war es kein
 * Aussetzer, sondern das Ende der Fahrt – dann wird die Aufzeichnung zum
 * Benennen angeboten statt heimlich weiterzulaufen und die Standzeit in die
 * Spur zu ziehen.
 */
export const RESUME_MAX_GAP_MS = 6 * 60 * 60 * 1000;

export interface ActiveTrackSession {
  id: string;
  startedAt: number;
  tripId: string;
  paused: boolean;
  /**
   * Zeitstempel des letzten gespeicherten Punktes – oder der Startzeit,
   * solange es noch keinen gibt. Grundlage für die Lücken-Prüfung.
   */
  lastPointAt: number;
}

function isValid(value: unknown): value is ActiveTrackSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<ActiveTrackSession>;
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    typeof session.tripId === 'string' &&
    session.tripId.length > 0 &&
    typeof session.startedAt === 'number' &&
    Number.isFinite(session.startedAt) &&
    typeof session.lastPointAt === 'number' &&
    Number.isFinite(session.lastPointAt) &&
    typeof session.paused === 'boolean'
  );
}

/** Die gespeicherte Aufzeichnung, oder null wenn keine (gültige) da ist. */
export function readActiveSession(): ActiveTrackSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('Laufende Aufzeichnung konnte nicht gelesen werden:', err);
    return null;
  }
}

export function writeActiveSession(session: ActiveTrackSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Laufende Aufzeichnung konnte nicht gespeichert werden:', err);
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Laufende Aufzeichnung konnte nicht entfernt werden:', err);
  }
}

/**
 * Was beim Start mit einer gespeicherten Aufzeichnung geschehen soll.
 *
 * - `resume`: weiterfahren, dieselbe Kennung behalten.
 * - `finish`: als beendete Aufzeichnung zum Benennen anbieten.
 * - `ignore`: gehört zu einem anderen Roadtrip – nicht anfassen, damit ein
 *   Wechsel hin und zurück die Tour nicht verliert.
 */
export type ResumeDecision =
  | { kind: 'resume'; session: ActiveTrackSession }
  | { kind: 'finish'; session: ActiveTrackSession }
  | { kind: 'ignore' };

export function decideResume(
  session: ActiveTrackSession | null,
  tripId: string | null,
  now: number
): ResumeDecision {
  if (!session) return { kind: 'ignore' };
  if (!tripId || session.tripId !== tripId) return { kind: 'ignore' };
  if (now - session.lastPointAt > RESUME_MAX_GAP_MS) return { kind: 'finish', session };
  return { kind: 'resume', session };
}
