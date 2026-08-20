import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export const MIN_PASSWORD_LENGTH = 6;

export type AuthErrorCode =
  | 'invalidEmail'
  | 'emailInUse'
  | 'weakPassword'
  | 'wrongCredentials'
  | 'tooManyAttempts'
  | 'popupClosed'
  | 'emailNotVerified'
  | 'alreadyVerified'
  | 'verificationFailed'
  | 'unknown';

export class AuthAccountError extends Error {
  constructor(readonly code: AuthErrorCode) {
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

/**
 * Legt ein neues Konto an und verschickt die Bestätigungs-Mail.
 *
 * `createUserWithEmailAndPassword` meldet das frische Konto sofort an –
 * ohne das abschließende `signOut` bliebe eine Sitzung mit unbestätigter
 * E-Mail-Adresse zurück, und damit stünde der Roadtrip-Beitritt offen,
 * obwohl die Adresse nie bestätigt wurde. Der Weg ist deshalb bewusst:
 * registrieren → Mail bestätigen → anmelden (siehe signInWithEmail).
 */
export async function registerWithEmail(email: string, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthAccountError('weakPassword');

  let user: User;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    user = cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }

  try {
    await sendEmailVerification(user);
  } catch {
    // Das Konto existiert jetzt trotzdem: nicht als 'unknown' melden,
    // sondern gezielt auf den erneuten Versand hinweisen.
    await signOut(auth).catch(() => undefined);
    throw new AuthAccountError('verificationFailed');
  }

  await signOut(auth).catch(() => undefined);
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

    // Der frisch geholte Token trägt den aktuellen Stand: Wer die Mail
    // zwischenzeitlich bestätigt hat, kommt hier ohne erneute Registrierung
    // durch.
    if (!cred.user.emailVerified) {
      await signOut(auth);
      throw new AuthAccountError('emailNotVerified');
    }

    return cred.user;
  } catch (err) {
    if (err instanceof AuthAccountError) throw err;
    throw new AuthAccountError(authErrorCode(err));
  }
}

export async function signInWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/**
 * Verschickt die Bestätigungs-Mail erneut – aufgerufen vom Anmelde-Screen,
 * auf dem niemand angemeldet ist. Firebase kann `sendEmailVerification` nur
 * für ein angemeldetes Konto ausführen, deshalb der kurze Umweg über eine
 * Anmeldung, die unmittelbar danach wieder beendet wird: Eine Sitzung mit
 * unbestätigter Adresse soll nicht zurückbleiben.
 *
 * Ist die Adresse bereits bestätigt, wird nichts verschickt und
 * 'alreadyVerified' gemeldet – dann genügt eine normale Anmeldung.
 */
export async function resendVerificationEmail(email: string, password: string): Promise<void> {
  let user: User;
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    user = cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }

  try {
    if (user.emailVerified) throw new AuthAccountError('alreadyVerified');
    await sendEmailVerification(user);
  } catch (err) {
    throw err instanceof AuthAccountError ? err : new AuthAccountError('verificationFailed');
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

/**
 * Gleiches für eine bereits angemeldete, aber unbestätigte Sitzung (etwa ein
 * Konto, das noch aus der Zeit vor dieser Prüfung angemeldet ist).
 */
export async function resendVerificationForCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthAccountError('unknown');
  if (user.emailVerified) throw new AuthAccountError('alreadyVerified');
  try {
    await sendEmailVerification(user);
  } catch {
    throw new AuthAccountError('verificationFailed');
  }
}

/**
 * Holt den Bestätigungsstatus des angemeldeten Kontos frisch vom Server und
 * wirft 'emailNotVerified', solange die Adresse nicht bestätigt ist.
 *
 * `reload()` ist der entscheidende Teil: Der im Gerät gespeicherte Token
 * behält `email_verified: false`, bis er erneuert wird – wer den Link in der
 * Mail auf einem anderen Gerät anklickt, käme sonst nie durch, obwohl die
 * Adresse längst bestätigt ist. Das anschließende `getIdToken(true)` sorgt
 * dafür, dass auch Firestore denselben Stand sieht (siehe firestore.rules,
 * emailVerified()) – ein Neuanlegen des Kontos ist nie nötig.
 */
export async function ensureEmailVerified(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new AuthAccountError('unknown');

  if (!user.emailVerified) {
    try {
      await user.reload();
      await user.getIdToken(true);
    } catch {
      throw new AuthAccountError('emailNotVerified');
    }
  }

  if (!auth.currentUser?.emailVerified) throw new AuthAccountError('emailNotVerified');
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

/**
 * Meldet das Konto auf diesem Gerät ab. `signOut` leert die Auth-Sitzung
 * (browserLocalPersistence, siehe firebase.ts) und stößt onAuthStateChanged
 * an – RoadtripProvider/AppGate blenden daraufhin von selbst zurück auf den
 * Login-Screen, ein manuelles Weiterleiten ist nicht nötig. Roadtrip- und
 * Gerätedaten bleiben unangetastet.
 */
export async function signOutAccount(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}
