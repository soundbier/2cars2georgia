import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
 *
 * Nachschlagen lässt sich immer nur ein einzelner Name, nie die ganze Liste:
 * `usernames/` erlaubt `get`, aber kein `list` (siehe firestore.rules) – sonst
 * wäre die Reservierung zugleich ein Verzeichnis aller registrierten Personen
 * samt UID. Deshalb gibt es hier auch keine freistehende Verfügbarkeitsprüfung
 * mehr: Ob ein Name frei ist, beantwortet der Reservierungsversuch selbst, und
 * nur der beantwortet es verbindlich.
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
