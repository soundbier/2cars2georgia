import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
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
const TRIP_EMAIL_DOMAIN = '2cars2georgia.trip';

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

/** Liest die Roadtrip-ID aus dem eingeloggten Auth-User (Präfix der Kunst-E-Mail). */
export function tripIdFromUser(user: User | null): string | null {
  if (!user?.email) return null;
  const [id] = user.email.split('@');
  return id || null;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Dieser Roadtrip-Name ist bereits vergeben. Wähle einen anderen Namen oder tritt dem bestehenden Roadtrip bei.';
    case 'auth/weak-password':
      return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Roadtrip-Name oder Passwort ist falsch.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.';
    default:
      return 'Da ist etwas schiefgelaufen. Bitte erneut versuchen.';
  }
}

export interface RoadtripAuthResult {
  tripId: string;
  tripName: string;
}

/** Legt einen neuen Roadtrip an und meldet das Gerät direkt darin an. */
export async function createRoadtrip(name: string, password: string): Promise<RoadtripAuthResult> {
  const trimmedName = name.trim();
  const tripId = slugifyTripName(trimmedName);
  if (!tripId) throw new Error('Bitte einen Namen für den Roadtrip eingeben.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
  }

  try {
    await createUserWithEmailAndPassword(auth, tripEmail(tripId), password);
    await setDoc(doc(db, 'roadtrips', tripId), {
      name: trimmedName,
      createdAt: serverTimestamp()
    });
    return { tripId, tripName: trimmedName };
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

/** Meldet das Gerät an einem bestehenden Roadtrip an. */
export async function joinRoadtrip(name: string, password: string): Promise<RoadtripAuthResult> {
  const tripId = slugifyTripName(name);
  if (!tripId) throw new Error('Bitte den Namen des Roadtrips eingeben.');

  try {
    await signInWithEmailAndPassword(auth, tripEmail(tripId), password);
    const snap = await getDoc(doc(db, 'roadtrips', tripId));
    const storedName = snap.exists() ? (snap.data().name as string | undefined) : undefined;
    return { tripId, tripName: storedName ?? name.trim() };
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

/** Meldet das Gerät vom aktuellen Roadtrip ab. */
export function leaveRoadtrip(): Promise<void> {
  return signOut(auth);
}
