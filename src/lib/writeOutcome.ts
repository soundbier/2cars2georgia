import type { TranslationKey } from '../i18n/translate';
import { trackWrite } from './pendingWrites';

/**
 * Rückmeldung für Schreibvorgänge, die sofort sichtbar sind.
 *
 * Firestore wendet einen Schreibvorgang zuerst lokal an (persistentLocalCache)
 * – der Eintrag verschwindet also unmittelbar aus der Liste. Das zurückgegebene
 * Promise löst sich aber erst auf, wenn der Server bestätigt hat. Wer darauf
 * wartet, bevor er eine Rückmeldung zeigt, bekommt unterwegs mit wackeliger
 * Verbindung genau das falsche Ergebnis: Der Eintrag ist längst weg, die
 * Bestätigung kommt Minuten später – und reißt die Verbindung zwischendurch
 * ab, lehnt Firestore das Promise ab, obwohl der Schreibvorgang im Cache
 * wartet und später ganz normal nachzieht. Auf dem Display erschien dann
 * „Fehler beim Löschen“, obwohl nichts kaputt war.
 *
 * Deshalb wird nicht mehr gewartet: Die Erfolgsmeldung (inklusive
 * „Rückgängig“) gehört zum lokalen Schreibvorgang, der Sync-Status hat mit
 * SyncStatusBanner seine eigene Anzeige. Als Fehler gilt nur noch, was
 * wirklich einer ist – eine abgelehnte Regel etwa, nicht eine fehlende
 * Verbindung.
 */

/** Firestore-Fehlercodes, die nur „gerade keine Verbindung“ bedeuten. */
const OFFLINE_CODES = new Set(['unavailable', 'cancelled', 'deadline-exceeded']);

export function isOfflineWriteError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return typeof code === 'string' && OFFLINE_CODES.has(code);
}

/**
 * Zählt den Schreibvorgang im Pending-Zähler mit und meldet nur echte Fehler.
 * Kehrt sofort zurück – der Aufrufer zeigt seine Erfolgsmeldung direkt an.
 */
export function writeOptimistically(promise: Promise<unknown>, onFailure: (err: unknown) => void): void {
  trackWrite(promise).catch((err) => {
    console.error(err);
    if (!isOfflineWriteError(err)) onFailure(err);
  });
}

/**
 * Meldung für einen fehlgeschlagenen Schreibvorgang.
 *
 * `permission-denied` heißt: Der Server hat den Schreibvorgang bewusst
 * abgelehnt – praktisch immer, weil die veröffentlichten Firestore-Regeln
 * nicht zum Stand von firestore.rules passen (siehe README, „Firestore-Regeln
 * veröffentlichen“). Der Eintrag verschwindet dann kurz aus der Liste, weil
 * der lokale Cache ihn schon angewendet hat, und taucht nach der Ablehnung
 * wieder auf. Ein allgemeines „Fehler beim Löschen“ führt hier in die Irre.
 */
export function writeErrorKey(err: unknown, fallback: TranslationKey): TranslationKey {
  return (err as { code?: string })?.code === 'permission-denied' ? 'common.writeRejected' : fallback;
}
