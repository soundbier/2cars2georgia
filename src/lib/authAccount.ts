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

export async function registerWithEmail(email: string, password: string): Promise<User> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthAccountError('weakPassword');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await sendEmailVerification(cred.user);
    return cred.user;
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    
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

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new AuthAccountError(authErrorCode(err));
  }
}

export function signOutAccount(): Promise<void> {
  return signOut(auth);
}
