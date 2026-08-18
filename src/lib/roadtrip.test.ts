import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

// Ohne diese Mocks würde der Import von ./roadtrip eine echte Firebase-App
// initialisieren (src/firebase.ts) – die Tests sollen aber weder Netz noch
// eine gültige Config brauchen.
vi.mock('../firebase', () => ({ auth: {}, db: {} }));

const createUserWithEmailAndPassword = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const signOut = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args: unknown[]) => createUserWithEmailAndPassword(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => signOut(...args)
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
  leaveRoadtrip,
  slugifyTripName,
  tripIdFromUser
} = await import('./roadtrip');

/** Firebase-Fehler tragen ihren Grund im `code`-Feld, nicht in der Message. */
function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
  createUserWithEmailAndPassword.mockResolvedValue({});
  signInWithEmailAndPassword.mockResolvedValue({});
  setDoc.mockResolvedValue(undefined);
  getDoc.mockResolvedValue({ exists: () => false });
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

  it('liefert null ohne angemeldeten Nutzer', () => {
    expect(tripIdFromUser(null)).toBeNull();
  });

  it('liefert null, wenn der Nutzer keine E-Mail hat', () => {
    expect(tripIdFromUser({ email: null } as User)).toBeNull();
  });
});

describe('createRoadtrip', () => {
  it('legt Auth-User und Roadtrip-Dokument unter derselben ID an', async () => {
    const result = await createRoadtrip('  Sommertour 2026 ', 'geheim123');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      'sommertour-2026@2cars2georgia.trip',
      'geheim123'
    );
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'roadtrips/sommertour-2026' },
      { name: 'Sommertour 2026', createdAt: 'SERVER_TIMESTAMP' }
    );
  });

  it('lehnt einen Namen ohne verwertbare Zeichen ab', async () => {
    await expect(createRoadtrip('###', 'geheim123')).rejects.toThrow(/Namen/);
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('lehnt zu kurze Passwörter ab, bevor Firebase überhaupt gefragt wird', async () => {
    await expect(createRoadtrip('Ostsee', 'a'.repeat(MIN_PASSWORD_LENGTH - 1))).rejects.toThrow(
      new RegExp(`${MIN_PASSWORD_LENGTH} Zeichen`)
    );
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('übersetzt einen belegten Namen in eine verständliche Meldung', async () => {
    createUserWithEmailAndPassword.mockRejectedValue(authError('auth/email-already-in-use'));
    await expect(createRoadtrip('Ostsee', 'geheim123')).rejects.toThrow(/bereits vergeben/);
  });
});

describe('joinRoadtrip', () => {
  it('meldet sich an und übernimmt den gespeicherten Anzeigenamen', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });

    const result = await joinRoadtrip('sommertour 2026', 'geheim123');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
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
    signInWithEmailAndPassword.mockRejectedValue(authError('auth/wrong-password'));
    const wrongPassword = await joinRoadtrip('Ostsee', 'falsch1').catch((e: Error) => e.message);

    signInWithEmailAndPassword.mockRejectedValue(authError('auth/user-not-found'));
    const unknownTrip = await joinRoadtrip('Gibtsnicht', 'falsch1').catch((e: Error) => e.message);

    expect(wrongPassword).toBe(unknownTrip);
  });

  it('meldet zu viele Fehlversuche gesondert', async () => {
    signInWithEmailAndPassword.mockRejectedValue(authError('auth/too-many-requests'));
    await expect(joinRoadtrip('Ostsee', 'falsch1')).rejects.toThrow(/Zu viele Versuche/);
  });

  it('lehnt einen leeren Namen ab', async () => {
    await expect(joinRoadtrip('  ', 'geheim123')).rejects.toThrow(/Namen/);
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
});

describe('leaveRoadtrip', () => {
  it('meldet den Auth-User ab', async () => {
    signOut.mockResolvedValue(undefined);
    await leaveRoadtrip();
    expect(signOut).toHaveBeenCalledWith({});
  });
});
