import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

// Ohne diese Mocks würde der Import von ./roadtrip eine echte Firebase-App
// initialisieren (src/firebase.ts) – die Tests sollen aber weder Netz noch
// eine gültige Config brauchen. `authState` ist mutierbar, damit Tests
// simulieren können, wer gerade als currentUser angemeldet ist (relevant für
// den Rollback in createRoadtrip).
const authState: { currentUser: { email: string } | null } = { currentUser: null };
vi.mock('../firebase', () => ({ auth: authState, db: {} }));

const createUserWithEmailAndPassword = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const signOut = vi.fn();
const deleteUser = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args: unknown[]) => createUserWithEmailAndPassword(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  deleteUser: (...args: unknown[]) => deleteUser(...args)
}));

const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  serverTimestamp: () => 'SERVER_TIMESTAMP'
}));

const {
  MIN_PASSWORD_LENGTH,
  createRoadtrip,
  joinRoadtrip,
  recoverRoadtrip,
  leaveRoadtrip,
  isAdminSession,
  enterAdminMode,
  setUpAdminAccess,
  slugifyTripName,
  tripIdFromUser,
  generateRecoveryCode,
  RoadtripAuthError
} = await import('./roadtrip');

/**
 * Der Fehlercode eines fehlgeschlagenen Aufrufs. Geprüft wird der Code, nicht
 * der angezeigte Satz – der lebt seit der Mehrsprachigkeit in src/i18n und
 * hängt an der eingestellten Sprache.
 */
async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'kein Fehler';
  } catch (err) {
    if (err instanceof RoadtripAuthError) return err.code;
    throw err;
  }
}

/** Firebase-Fehler tragen ihren Grund im `code`-Feld, nicht in der Message. */
function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

/** Format, das generateRecoveryCode() garantiert: vier 5er-Blöcke, Alphabet ohne 0/O/1/I/L. */
const RECOVERY_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}){3}$/;

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = null;
  // Simuliert den echten Firebase-Nebeneffekt: Nach erfolgreichem
  // createUserWithEmailAndPassword ist der neue User currentUser.
  createUserWithEmailAndPassword.mockImplementation(async (_auth: unknown, email: string) => {
    authState.currentUser = { email };
    return {};
  });
  signInWithEmailAndPassword.mockImplementation(async (_auth: unknown, email: string) => {
    authState.currentUser = { email };
    return {};
  });
  setDoc.mockResolvedValue(undefined);
  getDoc.mockResolvedValue({ exists: () => false });
  deleteUser.mockResolvedValue(undefined);
});

describe('slugifyTripName', () => {
  it('macht aus einem Namen eine kleingeschriebene ID mit Bindestrichen', () => {
    expect(slugifyTripName('Sommertour 2026')).toBe('sommertour-2026');
  });

  it('reduziert Umlaute und Akzente auf Basisbuchstaben', () => {
    expect(slugifyTripName('Müritz Törn')).toBe('muritz-torn');
    expect(slugifyTripName('Côte dAzur')).toBe('cote-dazur');
  });

  it('wirft Sonderzeichen raus und fasst Trenner zusammen', () => {
    expect(slugifyTripName('Elbe // Havel!!  2025')).toBe('elbe-havel-2025');
  });

  it('entfernt führende und schließende Bindestriche', () => {
    expect(slugifyTripName('  --Ostsee--  ')).toBe('ostsee');
  });

  it('liefert einen leeren String, wenn nichts Verwertbares übrig bleibt', () => {
    expect(slugifyTripName('!!!')).toBe('');
    expect(slugifyTripName('   ')).toBe('');
  });

  it('bildet unterschiedliche Schreibweisen auf dieselbe ID ab', () => {
    // Wichtig fürs Beitreten: Wer "sommertour 2026" tippt, muss denselben
    // Roadtrip erwischen wie beim Anlegen mit "Sommertour 2026".
    expect(slugifyTripName('sommertour 2026')).toBe(slugifyTripName('Sommertour 2026'));
  });
});

describe('tripIdFromUser', () => {
  it('liest die Roadtrip-ID aus der Kunst-E-Mail', () => {
    expect(tripIdFromUser({ email: 'sommertour-2026@2cars2georgia.trip' } as User)).toBe(
      'sommertour-2026'
    );
  });

  it('liefert dieselbe ID für den Wiederherstellungs-Account', () => {
    // Beide Domains tragen denselben lokalen Teil – Rules und App
    // unterscheiden absichtlich nicht, über welchen Weg man angemeldet ist.
    expect(tripIdFromUser({ email: 'sommertour-2026@2cars2georgia.recovery' } as User)).toBe(
      'sommertour-2026'
    );
  });

  it('liefert null ohne angemeldeten Nutzer', () => {
    expect(tripIdFromUser(null)).toBeNull();
  });

  it('liefert null, wenn der Nutzer keine E-Mail hat', () => {
    expect(tripIdFromUser({ email: null } as User)).toBeNull();
  });
});

describe('generateRecoveryCode', () => {
  it('liefert vier 5er-Blöcke aus einem verwechslungsarmen Alphabet', () => {
    expect(generateRecoveryCode()).toMatch(RECOVERY_CODE_PATTERN);
  });

  it('liefert bei wiederholtem Aufruf unterschiedliche Codes', () => {
    // Kollisionswahrscheinlichkeit bei echtem Zufall verschwindend gering –
    // ein Fehlschlag hier deutet auf einen kaputten Zufallsgenerator hin.
    const codes = new Set(Array.from({ length: 20 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(20);
  });
});

describe('createRoadtrip', () => {
  it('legt Haupt-, Wiederherstellungs- und Admin-Account an und meldet am Ende wieder den Hauptaccount an', async () => {
    const result = await createRoadtrip('  Sommertour 2026 ', 'geheim123', 'adminpass1');

    expect(result.tripId).toBe('sommertour-2026');
    expect(result.tripName).toBe('Sommertour 2026');
    expect(result.recoveryCode).toMatch(RECOVERY_CODE_PATTERN);

    expect(createUserWithEmailAndPassword).toHaveBeenNthCalledWith(
      1,
      authState,
      'sommertour-2026@2cars2georgia.trip',
      'geheim123'
    );
    expect(createUserWithEmailAndPassword).toHaveBeenNthCalledWith(
      2,
      authState,
      'sommertour-2026@2cars2georgia.recovery',
      result.recoveryCode
    );
    expect(createUserWithEmailAndPassword).toHaveBeenNthCalledWith(
      3,
      authState,
      'sommertour-2026@2cars2georgia.admin',
      'adminpass1'
    );
    // Das Anlegen der weiteren Accounts wechselt jeweils die Sitzung –
    // am Ende muss wieder der Hauptaccount angemeldet sein.
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'sommertour-2026@2cars2georgia.trip',
      'geheim123'
    );
    expect(authState.currentUser?.email).toBe('sommertour-2026@2cars2georgia.trip');

    expect(setDoc).toHaveBeenCalledWith(
      { path: 'roadtrips/sommertour-2026' },
      { name: 'Sommertour 2026', createdAt: 'SERVER_TIMESTAMP' }
    );
  });

  it('lehnt einen Namen ohne verwertbare Zeichen ab', async () => {
    await expect(errorCode(createRoadtrip('###', 'geheim123', 'adminpass1'))).resolves.toBe('missingName');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('lehnt zu kurze Passwörter ab, bevor Firebase überhaupt gefragt wird', async () => {
    const code = await errorCode(createRoadtrip('Ostsee', 'a'.repeat(MIN_PASSWORD_LENGTH - 1), 'adminpass1'));

    expect(code).toBe('passwordTooShort');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('übersetzt einen belegten Namen in einen eigenen Fehlercode', async () => {
    createUserWithEmailAndPassword.mockRejectedValueOnce(authError('auth/email-already-in-use'));
    await expect(errorCode(createRoadtrip('Ostsee', 'geheim123', 'adminpass1'))).resolves.toBe('nameTaken');
  });

  it('lehnt ein zu kurzes Admin-Passwort ab, bevor Firebase überhaupt gefragt wird', async () => {
    const code = await errorCode(
      createRoadtrip('Ostsee', 'geheim123', 'a'.repeat(MIN_PASSWORD_LENGTH - 1))
    );

    expect(code).toBe('passwordTooShort');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('lehnt ein Admin-Passwort ab, das dem Roadtrip-Passwort entspricht', async () => {
    // Sonst wäre es keine zweite Schranke: Das Roadtrip-Passwort kennt die
    // ganze Crew.
    const code = await errorCode(createRoadtrip('Ostsee', 'geheim123', 'geheim123'));

    expect(code).toBe('adminPasswordSameAsTrip');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('räumt den Hauptaccount auf, wenn der Wiederherstellungs-Account nicht angelegt werden kann', async () => {
    createUserWithEmailAndPassword.mockImplementationOnce(async (_auth: unknown, email: string) => {
      authState.currentUser = { email };
      return {};
    });
    createUserWithEmailAndPassword.mockRejectedValueOnce(new Error('netzwerk kaputt'));

    await expect(errorCode(createRoadtrip('Ostsee', 'geheim123', 'adminpass1'))).resolves.toBe('unknown');

    // Zum Zeitpunkt des Fehlers war der Hauptaccount currentUser – der wird
    // best-effort wieder gelöscht, damit der Name nicht dauerhaft blockiert.
    expect(deleteUser).toHaveBeenCalledWith({ email: 'ostsee@2cars2georgia.trip' });
  });
});

describe('joinRoadtrip', () => {
  it('meldet sich an und übernimmt den gespeicherten Anzeigenamen', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });

    const result = await joinRoadtrip('sommertour 2026', 'geheim123');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'sommertour-2026@2cars2georgia.trip',
      'geheim123'
    );
  });

  it('fällt auf die Eingabe zurück, wenn das Dokument noch keinen Namen hat', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await expect(joinRoadtrip(' Ostsee ', 'geheim123')).resolves.toEqual({
      tripId: 'ostsee',
      tripName: 'Ostsee'
    });
  });

  it('verrät bei falschem Passwort nicht, ob der Roadtrip existiert', async () => {
    // Getrennte Meldungen für "Name unbekannt" und "Passwort falsch" wären ein
    // Orakel, mit dem sich vorhandene Roadtrip-Namen durchprobieren ließen.
    signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/wrong-password'));
    const wrongPassword = await errorCode(joinRoadtrip('Ostsee', 'falsch1'));

    signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/user-not-found'));
    const unknownTrip = await errorCode(joinRoadtrip('Gibtsnicht', 'falsch1'));

    expect(wrongPassword).toBe('wrongCredentials');
    expect(wrongPassword).toBe(unknownTrip);
  });

  it('meldet zu viele Fehlversuche gesondert', async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/too-many-requests'));
    await expect(errorCode(joinRoadtrip('Ostsee', 'falsch1'))).resolves.toBe('tooManyAttempts');
  });

  it('lehnt einen leeren Namen ab', async () => {
    await expect(errorCode(joinRoadtrip('  ', 'geheim123'))).resolves.toBe('missingName');
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
});

describe('recoverRoadtrip', () => {
  it('meldet sich über den Wiederherstellungs-Account an', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });

    const result = await recoverRoadtrip('sommertour 2026', ' XJ3K9-7QRTY-ABCDE-FGHJK ');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'sommertour-2026@2cars2georgia.recovery',
      'XJ3K9-7QRTY-ABCDE-FGHJK'
    );
  });

  it('lehnt einen leeren Namen ab', async () => {
    await expect(errorCode(recoverRoadtrip('  ', 'XJ3K9-7QRTY-ABCDE-FGHJK'))).resolves.toBe(
      'missingName'
    );
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('übersetzt einen falschen Code in denselben Fehlercode wie ein falsches Passwort', async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/invalid-credential'));
    await expect(errorCode(recoverRoadtrip('Ostsee', 'falscher-code'))).resolves.toBe(
      'wrongCredentials'
    );
  });
});

describe('leaveRoadtrip', () => {
  it('meldet den Auth-User ab', async () => {
    signOut.mockResolvedValue(undefined);
    await leaveRoadtrip();
    expect(signOut).toHaveBeenCalledWith(authState);
  });
});

describe('isAdminSession', () => {
  it('erkennt den Admin-Zugang an der Domain', () => {
    expect(isAdminSession({ email: 'ostsee@2cars2georgia.admin' } as User)).toBe(true);
  });

  it('sieht normalen Zugang und Wiederherstellung nicht als Admin', () => {
    expect(isAdminSession({ email: 'ostsee@2cars2georgia.trip' } as User)).toBe(false);
    expect(isAdminSession({ email: 'ostsee@2cars2georgia.recovery' } as User)).toBe(false);
    expect(isAdminSession(null)).toBe(false);
  });
});

describe('enterAdminMode', () => {
  it('meldet das Gerät auf dem Admin-Zugang desselben Roadtrips an', async () => {
    await enterAdminMode('ostsee', ' adminpass1 ');

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'ostsee@2cars2georgia.admin',
      'adminpass1'
    );
  });

  it('übersetzt ein falsches Admin-Passwort in einen Fehlercode', async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/invalid-credential'));
    await expect(errorCode(enterAdminMode('ostsee', 'falsch'))).resolves.toBe('wrongCredentials');
  });
});

describe('setUpAdminAccess', () => {
  it('legt den Admin-Zugang für einen Roadtrip ohne an', async () => {
    await setUpAdminAccess('ostsee', 'adminpass1');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'ostsee@2cars2georgia.admin',
      'adminpass1'
    );
  });

  it('meldet einen bereits eingerichteten Admin-Zugang mit eigenem Code', async () => {
    createUserWithEmailAndPassword.mockRejectedValueOnce(authError('auth/email-already-in-use'));

    // Nicht 'nameTaken': Hier ist nicht der Roadtrip-Name belegt, sondern der
    // Admin-Zugang steht bereits – dafür gibt es einen eigenen Hinweis.
    await expect(errorCode(setUpAdminAccess('ostsee', 'adminpass1'))).resolves.toBe(
      'adminAlreadyExists'
    );
  });

  it('lehnt ein zu kurzes Admin-Passwort ab', async () => {
    const code = await errorCode(setUpAdminAccess('ostsee', 'a'.repeat(MIN_PASSWORD_LENGTH - 1)));

    expect(code).toBe('passwordTooShort');
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });
});
