import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Prüft die E-Mail-Bestätigung rund um Registrierung, Anmeldung und
 * Roadtrip-Beitritt (siehe firestore.rules für die serverseitige Hälfte).
 */

// Ohne diesen Mock würde der Import eine echte Firebase-App hochfahren
// (src/firebase.ts) – die Tests brauchen weder Netz noch gültige Config.
// vi.hoisted, weil vi.mock an den Dateianfang gezogen wird und die Fakes
// dort schon stehen müssen.
const { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } =
  vi.hoisted(() => ({
    auth: { currentUser: null } as { currentUser: unknown },
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    signOut: vi.fn()
  }));

vi.mock('../firebase', () => ({ auth, googleProvider: {} }));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args: unknown[]) => createUserWithEmailAndPassword(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: (...args: unknown[]) => sendEmailVerification(...args),
  signOut: (...args: unknown[]) => signOut(...args)
}));

import {
  AuthAccountError,
  ensureEmailVerified,
  registerWithEmail,
  resendVerificationEmail,
  signInWithEmail
} from './authAccount';

function fakeUser(emailVerified: boolean) {
  return {
    emailVerified,
    reload: vi.fn().mockResolvedValue(undefined),
    getIdToken: vi.fn().mockResolvedValue('token')
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.currentUser = null;
  sendEmailVerification.mockResolvedValue(undefined);
  signOut.mockResolvedValue(undefined);
});

describe('registerWithEmail', () => {
  it('verschickt die Bestätigungs-Mail und lässt keine unbestätigte Sitzung zurück', async () => {
    const user = fakeUser(false);
    createUserWithEmailAndPassword.mockResolvedValue({ user });

    await registerWithEmail(' neu@example.com ', 'geheim123');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'neu@example.com', 'geheim123');
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('meldet einen fehlgeschlagenen Versand gezielt statt als unbekannten Fehler', async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser(false) });
    sendEmailVerification.mockRejectedValue(new Error('smtp down'));

    await expect(registerWithEmail('neu@example.com', 'geheim123')).rejects.toMatchObject({
      code: 'verificationFailed'
    });
    expect(signOut).toHaveBeenCalled();
  });

  it('schreibt gar nicht erst mit einem zu kurzen Passwort', async () => {
    await expect(registerWithEmail('neu@example.com', 'kurz')).rejects.toMatchObject({
      code: 'weakPassword'
    });
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });
});

describe('signInWithEmail', () => {
  it('meldet ein unbestätigtes Konto wieder ab', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser(false) });

    await expect(signInWithEmail('neu@example.com', 'geheim123')).rejects.toMatchObject({
      code: 'emailNotVerified'
    });
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('lässt ein bestätigtes Konto ohne erneute Registrierung durch', async () => {
    const user = fakeUser(true);
    signInWithEmailAndPassword.mockResolvedValue({ user });

    await expect(signInWithEmail('neu@example.com', 'geheim123')).resolves.toBe(user);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('resendVerificationEmail', () => {
  it('verschickt die Mail erneut und meldet danach wieder ab', async () => {
    const user = fakeUser(false);
    signInWithEmailAndPassword.mockResolvedValue({ user });

    await resendVerificationEmail('neu@example.com', 'geheim123');

    expect(sendEmailVerification).toHaveBeenCalledWith(user);
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('verschickt nichts, wenn die Adresse längst bestätigt ist', async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser(true) });

    await expect(resendVerificationEmail('alt@example.com', 'geheim123')).rejects.toMatchObject({
      code: 'alreadyVerified'
    });
    expect(sendEmailVerification).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('meldet falsche Anmeldedaten als solche', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });

    await expect(resendVerificationEmail('neu@example.com', 'falsch')).rejects.toMatchObject({
      code: 'wrongCredentials'
    });
  });
});

describe('ensureEmailVerified', () => {
  it('lässt ein bestätigtes Konto durch', async () => {
    auth.currentUser = fakeUser(true);
    await expect(ensureEmailVerified()).resolves.toBeUndefined();
  });

  it('blockt ein unbestätigtes Konto (kein Roadtrip-Beitritt)', async () => {
    auth.currentUser = fakeUser(false);
    await expect(ensureEmailVerified()).rejects.toBeInstanceOf(AuthAccountError);
    await expect(ensureEmailVerified()).rejects.toMatchObject({ code: 'emailNotVerified' });
  });

  it('erkennt eine zwischenzeitliche Bestätigung nach Reload, ohne neue Registrierung', async () => {
    const user = fakeUser(false);
    // Der Link wurde auf einem anderen Gerät angeklickt: erst reload() bringt
    // den neuen Stand, danach hängt der Token nicht mehr hinterher.
    user.reload = vi.fn().mockImplementation(async () => {
      user.emailVerified = true;
    });
    auth.currentUser = user;

    await expect(ensureEmailVerified()).resolves.toBeUndefined();
    expect(user.reload).toHaveBeenCalled();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
});
