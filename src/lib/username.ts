import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Eindeutiger Anzeigename pro Person, siehe firestore.rules (`users/{uid}`
 * und `usernames/{normalizedName}`).
 *
 * Firestore kennt keine serverseitigen "unique"-Constraints und dieses
 * Projekt hat keine Cloud Functions – die Eindeutigkeit wird deshalb über
 * ein zweites Dokument erzwungen: `usernames/{normalizedName}` existiert
 * höchstens einmal pro normalisiertem Namen, sein Inhalt ist die UID, die ihn
 * belegt hat. `reserveDisplayName` legt `users/{uid}` und
 * `usernames/{normalizedName}` gemeinsam in einer Transaktion an – entweder
 * beide oder keins, und die Transaktion scheitert atomar, falls der Name in
 * der Zwischenzeit von einer anderen Sitzung belegt wurde.
 */

/** Passt zur Längenprüfung von `author`/`displayName` in firestore.rules. */
export const MAX_DISPLAY_NAME_LENGTH = 60;

/** Führende/abschließende Leerzeichen weg, mehrfache in der Mitte zusammengezogen. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_DISPLAY_NAME_LENGTH);
}

/**
 * Bildet den Dokument-Schlüssel unter `usernames/` aus einem Anzeigenamen:
 * ohne Rücksicht auf Groß-/Kleinschreibung oder Akzente, damit "Léon" und
 * "leon" als derselbe Name gelten. Nur für den Vergleich gedacht – der
 * tatsächliche Anzeigename bleibt unverändert in `users/{uid}.displayName`
 * gespeichert.
 */
export function normalizeUsernameKey(raw: string): string {
  return normalizeDisplayName(raw)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type UsernameErrorCode = 'invalidName' | 'nameTaken' | 'unknown';

export class UsernameError extends Error {
  constructor(readonly code: UsernameErrorCode) {
    super(`username failed: ${code}`);
    this.name = 'UsernameError';
  }
}

/** Prüfung, ob ein Name derzeit noch frei ist (best effort, keine Garantie ohne Reservierung). */
export async function isDisplayNameAvailable(name: string): Promise<boolean> {
  const key = normalizeUsernameKey(name);
  if (!key) return false;
  const snap = await getDoc(doc(db, 'usernames', key));
  return !snap.exists();
}

/**
 * Legt das Profil `users/{uid}` an und reserviert den Anzeigenamen atomar.
 * Wirft `UsernameError('nameTaken')`, falls der normalisierte Name bereits
 * vergeben ist (auch bei einem Gleichzeitigkeits-Wettlauf zweier Geräte).
 */
export async function reserveDisplayName(uid: string, email: string, rawName: string): Promise<string> {
  const displayName = normalizeDisplayName(rawName);
  const key = normalizeUsernameKey(rawName);
  if (!displayName || !key) throw new UsernameError('invalidName');

  const usernameRef = doc(db, 'usernames', key);
  const userRef = doc(db, 'users', uid);

  try {
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(usernameRef);
      if (existing.exists()) throw new UsernameError('nameTaken');
      tx.set(usernameRef, { uid, createdAt: serverTimestamp() });
      tx.set(userRef, { displayName, email, createdAt: serverTimestamp() });
    });
  } catch (err) {
    if (err instanceof UsernameError) throw err;
    throw new UsernameError('unknown');
  }

  return displayName;
}
