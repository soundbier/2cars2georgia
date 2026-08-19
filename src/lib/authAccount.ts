import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  User
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

/**
 * Persönliche Firebase-Auth-Konten: E-Mail/Passwort oder Google, jeweils mit
 * einer echten, eindeutigen UID pro Person (request.auth.uid in
 * firestore.rules). Ersetzt den bisherigen technischen Roadtrip-User pro
 * Roadtrip (früher in lib/roadtrip.ts) – ein Konto gehört jetzt einer
 * Person, nicht einem Roadtrip.
 */

export const MIN_PASSWORD_LENGTH = 6;

export type AuthErrorCode =
  | 'invalidEmail'
  | 'emailInUse'
  | 'weakPassword'
  | 'wrongCredentials'
  | 'tooManyAttempts'
  | 'popupClosed'
  | 'unknown';

export class AuthAccountError extends Error {
  constructor(readonly code: AuthErrorCode) {
    // Die Message ist nur für Logs gedacht, nie für die Anzeige – die
    // Oberfläche übersetzt `code` über die Schlüssel `authError.{code}`.
    super(`auth failed: ${code}`);
    this.name = 'AuthAccountError';
  }
}

function authErrorCode(err: unknown): AuthErrorCode {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'invalidEmail';
    case 'auth/email-already-in-use':
      return 'emailInUse';
    case 'auth/weak-password':
      return 'weakPassword';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'wrongCredentials';
    case 'auth/too-many-requests':
      return 'tooManyAttempts';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'popupClosed';
    default:
      return 'unknown';
  }
}

/** Legt ein neues Konto per E-Mail/Passwort an und meldet es zugleich an. */
export async function registerWithEmail(email: string, password: string): Promise<User> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthAccountError('weakPassword');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/** Meldet ein bestehendes Konto per E-Mail/Passwort an. */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/** Meldet ein Konto per Google-Popup an (legt es bei Bedarf automatisch an). */
export async function signInWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/** Schickt eine Passwort-Reset-Mail – ersetzt den früheren Wiederherstellungscode. */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/** Meldet das Gerät komplett ab (nicht nur vom aktuellen Roadtrip). */
export function signOutAccount(): Promise<void> {
  return signOut(auth);
}
