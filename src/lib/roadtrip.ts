import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Firebase Auth kennt keine "Räume", nur E-Mail/Passwort-Nutzer. Ein Roadtrip
// wird deshalb 1:1 auf einen technischen Auth-User abgebildet: Die
// Roadtrip-ID (aus dem Namen abgeleitet) wird zum lokalen Teil einer
// künstlichen E-Mail-Adresse, das Roadtrip-Passwort ist das Auth-Passwort.
// Firestore-Regeln vergleichen anschließend `request.auth.token.email` mit
// dem angefragten Pfad `roadtrips/{tripId}/…` – das ist der eigentliche
// Zugriffsschutz, nicht die UI.
//
// Zusätzlich zum normalen Auth-User legt createRoadtrip einen zweiten,
// unabhängigen Auth-User unter einer anderen Domain an: den
// Wiederherstellungs-Account. Sein Passwort ist ein einmalig angezeigter,
// zufälliger Code. Da beide E-Mail-Adressen denselben lokalen Teil (die
// tripId) tragen, liefert tripIdFromUser() für beide dasselbe Ergebnis –
// die Firestore-Regeln (die nur den lokalen Teil vergleichen) und der Rest
// der App unterscheiden nicht, über welchen der beiden Wege ein Gerät
// angemeldet ist. Ohne eigenes Backend lässt sich das Passwort eines
// bestehenden Firebase-Auth-Users nicht "zurücksetzen" – der
// Wiederherstellungscode ist deshalb technisch ein zweites, dauerhaft
// gültiges Passwort fürs Comeback, kein Reset-Mechanismus.
const TRIP_EMAIL_DOMAIN = '2cars2georgia.trip';
const RECOVERY_EMAIL_DOMAIN = '2cars2georgia.recovery';

export const MIN_PASSWORD_LENGTH = 6;

/** Wandelt einen Roadtrip-Namen in eine URL-/E-Mail-taugliche ID um. */
export function slugifyTripName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tripEmail(tripId: string): string {
  return `${tripId}@${TRIP_EMAIL_DOMAIN}`;
}

function recoveryEmail(tripId: string): string {
  return `${tripId}@${RECOVERY_EMAIL_DOMAIN}`;
}

/** Liest die Roadtrip-ID aus dem eingeloggten Auth-User (Präfix der Kunst-E-Mail). */
export function tripIdFromUser(user: User | null): string | null {
  if (!user?.email) return null;
  const [id] = user.email.split('@');
  return id || null;
}

// Alphabet ohne leicht verwechselbare Zeichen (0/O, 1/I/L) – der Code wird
// von Hand abgetippt oder abfotografiert, nicht per Copy-paste weitergegeben.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_GROUP_COUNT = 4;
const RECOVERY_GROUP_LENGTH = 5;

/**
 * Erzeugt einen zufälligen Wiederherstellungscode, z.B. "XJ3K9-7QRTY-…".
 * 20 Zeichen aus einem 32er-Alphabet ergeben ~100 Bit Entropie – deutlich
 * mehr, als sich ohne Rate-Limit-Umgehung praktisch erraten lässt.
 */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(RECOVERY_GROUP_COUNT * RECOVERY_GROUP_LENGTH);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += RECOVERY_GROUP_LENGTH) {
    groups.push(chars.slice(i, i + RECOVERY_GROUP_LENGTH).join(''));
  }
  return groups.join('-');
}

/**
 * Gründe, aus denen eine Anmeldung scheitern kann – als Code statt als fertig
 * formulierter Satz.
 *
 * Diese Datei kennt keine Sprache: Welcher Text daraus wird, entscheidet die
 * Oberfläche über die Schlüssel `authError.{code}` in src/i18n. Vorher standen
 * hier deutsche Meldungen, die sich nicht übersetzen ließen, ohne die
 * Fehlerbehandlung anzufassen.
 */
export type RoadtripErrorCode =
  | 'nameTaken'
  | 'passwordTooShort'
  | 'wrongCredentials'
  | 'tooManyAttempts'
  | 'missingName'
  | 'unknown';

export class RoadtripAuthError extends Error {
  constructor(readonly code: RoadtripErrorCode) {
    // Die Message ist nur für Logs und Fehlerberichte gedacht, nie für die
    // Anzeige – deshalb bewusst der nackte Code.
    super(`roadtrip auth failed: ${code}`);
    this.name = 'RoadtripAuthError';
  }
}

function authErrorCode(err: unknown): RoadtripErrorCode {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'nameTaken';
    case 'auth/weak-password':
      return 'passwordTooShort';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'wrongCredentials';
    case 'auth/too-many-requests':
      return 'tooManyAttempts';
    default:
      return 'unknown';
  }
}

export interface RoadtripAuthResult {
  tripId: string;
  tripName: string;
}

export interface CreateRoadtripResult extends RoadtripAuthResult {
  /** Nur bei der Erstellung verfügbar – wird danach nirgends gespeichert. */
  recoveryCode: string;
}

async function resolveTripName(tripId: string, fallback: string): Promise<string> {
  const snap = await getDoc(doc(db, 'roadtrips', tripId));
  const storedName = snap.exists() ? (snap.data().name as string | undefined) : undefined;
  return storedName ?? fallback;
}

/** Legt einen neuen Roadtrip an, meldet das Gerät darin an und liefert den Wiederherstellungscode. */
export async function createRoadtrip(name: string, password: string): Promise<CreateRoadtripResult> {
  const trimmedName = name.trim();
  const tripId = slugifyTripName(trimmedName);
  if (!tripId) throw new RoadtripAuthError('missingName');
  if (password.length < MIN_PASSWORD_LENGTH) throw new RoadtripAuthError('passwordTooShort');

  const recoveryCode = generateRecoveryCode();

  try {
    await createUserWithEmailAndPassword(auth, tripEmail(tripId), password);
    await setDoc(doc(db, 'roadtrips', tripId), {
      name: trimmedName,
      createdAt: serverTimestamp()
    });
    // Erzeugt den zweiten Auth-User; wechselt dabei die aktive Sitzung auf ihn.
    await createUserWithEmailAndPassword(auth, recoveryEmail(tripId), recoveryCode);
    // Gerät soll nach dem Anlegen wie gewohnt über den Hauptzugang angemeldet sein.
    await signInWithEmailAndPassword(auth, tripEmail(tripId), password);
    return { tripId, tripName: trimmedName, recoveryCode };
  } catch (err) {
    // Best effort: den zuletzt angelegten Auth-User wieder loswerden, damit
    // kein halb fertiger Roadtrip den Namen dauerhaft blockiert. Schlägt das
    // fehl (z.B. weil noch gar kein User angelegt wurde), wird das ignoriert.
    if (auth.currentUser) {
      await deleteUser(auth.currentUser).catch(() => undefined);
    }
    throw new RoadtripAuthError(authErrorCode(err));
  }
}

/** Meldet das Gerät mit dem normalen Roadtrip-Passwort an. */
export async function joinRoadtrip(name: string, password: string): Promise<RoadtripAuthResult> {
  const tripId = slugifyTripName(name);
  if (!tripId) throw new RoadtripAuthError('missingName');

  try {
    await signInWithEmailAndPassword(auth, tripEmail(tripId), password);
    return { tripId, tripName: await resolveTripName(tripId, name.trim()) };
  } catch (err) {
    throw new RoadtripAuthError(authErrorCode(err));
  }
}

/**
 * Meldet das Gerät über den Wiederherstellungscode an – der Weg zurück, wenn
 * das normale Roadtrip-Passwort vergessen wurde. Der Code bleibt danach
 * weiterhin gültig, es handelt sich nicht um einen einmaligen Reset.
 */
export async function recoverRoadtrip(name: string, recoveryCode: string): Promise<RoadtripAuthResult> {
  const tripId = slugifyTripName(name);
  if (!tripId) throw new RoadtripAuthError('missingName');

  try {
    await signInWithEmailAndPassword(auth, recoveryEmail(tripId), recoveryCode.trim());
    return { tripId, tripName: await resolveTripName(tripId, name.trim()) };
  } catch (err) {
    throw new RoadtripAuthError(authErrorCode(err));
  }
}

/** Meldet das Gerät vom aktuellen Roadtrip ab. */
export function leaveRoadtrip(): Promise<void> {
  return signOut(auth);
}
