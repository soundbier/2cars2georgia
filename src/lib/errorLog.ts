import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { tripPath } from '../hooks/useRoadtrip';

/**
 * Fehlerprotokoll im Roadtrip selbst (Collection `errors`, siehe
 * firestore.rules).
 *
 * Sentry (lib/sentry.ts) sieht nur, was das Gerät auch senden kann: Es
 * braucht eine Verbindung und einen konfigurierten DSN. Unterwegs ohne Netz –
 * also genau dort, wo die App eigentlich läuft – geht ein Absturz damit
 * verloren. Firestore-Schreibvorgänge dagegen warten offline im lokalen Cache
 * und ziehen beim nächsten Empfang nach; das Protokoll ist außerdem für die
 * Crew selbst einsehbar, statt nur für ein externes Dashboard.
 *
 * Bewusst „best effort": Kein await, kein Fehler nach außen, keine Anzeige.
 * Ein fehlgeschlagener Fehlerbericht darf niemals das eigentliche Problem
 * überdecken – und schon gar nicht selbst einen neuen Bericht auslösen.
 */

/** Grenzen aus firestore.rules – längere Werte würde der Server ablehnen. */
const LIMITS = {
  message: 1000,
  stack: 4000,
  context: 200,
  author: 60,
  authorId: 128,
  appVersion: 40,
  userAgent: 500,
  url: 500
} as const;

/**
 * Ein einmal kaputter Render-Pfad feuert oft im Sekundentakt. Ohne Bremse
 * schriebe ein einzelnes Gerät tausende gleiche Dokumente – Kosten, die
 * niemandem beim Debuggen helfen.
 */
const DEDUPE_WINDOW_MS = 60_000;

let tripId: string | null = null;
let author: string | null = null;
let authorId: string | null = null;
const lastLogged = new Map<string, number>();

/** Ordnet die Berichte dem angemeldeten Roadtrip/Crewmitglied zu (siehe App.tsx). */
export function setErrorLogContext(
  nextTripId: string | null,
  nextAuthor: string | null,
  nextAuthorId: string | null = null
): void {
  tripId = nextTripId;
  author = nextAuthor;
  authorId = nextAuthorId;
  lastLogged.clear();
}

function clip(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

/** Macht aus beliebigem Geworfenen eine nicht-leere Meldung (isText verlangt Länge > 0). */
export function errorMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message || err.name
      : typeof err === 'string'
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
  const trimmed = raw?.trim();
  return clip(trimmed || 'Unbekannter Fehler', LIMITS.message);
}

/** true, solange derselbe Fehler innerhalb des Zeitfensters schon protokolliert wurde. */
function isDuplicate(key: string, now: number): boolean {
  const previous = lastLogged.get(key);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return true;
  lastLogged.set(key, now);
  return false;
}

function appVersion(): string | undefined {
  // In Tests (und überall außerhalb des Vite-Builds) gibt es die Konstante nicht.
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined;
}

/**
 * Schreibt einen Fehler ins Protokoll des Roadtrips. Ohne angemeldeten
 * Roadtrip gibt es keinen Pfad zum Schreiben – dann passiert nichts.
 *
 * `context` beschreibt die Stelle, an der es geknallt hat ("react",
 * "unhandledrejection", …), nicht den Fehler selbst.
 */
export function logError(err: unknown, context?: string): void {
  if (!tripId) return;

  const message = errorMessage(err);
  const now = Date.now();
  if (isDuplicate(`${context ?? ''}|${message}`, now)) return;

  // Optionale Felder dürfen laut Regeln fehlen, aber nicht undefined sein –
  // Firestore lehnt undefined-Werte schon im Client ab.
  const entry: Record<string, string | number> = { timestamp: now, message };
  const stack = err instanceof Error ? err.stack : undefined;
  if (stack) entry.stack = clip(stack, LIMITS.stack);
  if (context) entry.context = clip(context, LIMITS.context);
  if (author) entry.author = clip(author, LIMITS.author);
  if (authorId) entry.authorId = clip(authorId, LIMITS.authorId);
  const version = appVersion();
  if (version) entry.appVersion = clip(version, LIMITS.appVersion);
  if (typeof navigator !== 'undefined') entry.userAgent = clip(navigator.userAgent, LIMITS.userAgent);
  if (typeof location !== 'undefined') entry.url = clip(location.href, LIMITS.url);

  // Absichtlich ohne trackWrite: Das Sync-Banner meldet ausstehende Arbeit der
  // Crew, ein Fehlerbericht im Hintergrund ist keine.
  addDoc(collection(db, tripPath(tripId, 'errors')), entry).catch((writeError) => {
    // Nur Konsole – ein erneuter logError-Aufruf drehte sich im Kreis.
    console.error('Fehlerbericht konnte nicht gespeichert werden:', writeError);
  });
}

/**
 * Hängt sich an die Fehlerquellen, die React nicht sieht: geworfene Fehler
 * außerhalb des Renderns und abgelehnte Promises ohne catch.
 */
export function installGlobalErrorLogging(): void {
  window.addEventListener('error', (event) => logError(event.error ?? event.message, 'window.error'));
  window.addEventListener('unhandledrejection', (event) => logError(event.reason, 'unhandledrejection'));
}

/** Nur für Tests: setzt Kontext und Dedupe-Fenster zurück. */
export function __resetErrorLogForTests(): void {
  tripId = null;
  author = null;
  authorId = null;
  lastLogged.clear();
}
