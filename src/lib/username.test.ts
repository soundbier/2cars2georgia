import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ohne diese Mocks würde der Import von ./username eine echte Firebase-App
// initialisieren (src/firebase.ts) – die Tests brauchen weder Netz noch
// gültige Config.
vi.mock('../firebase', () => ({ auth: {}, db: {} }));

const runTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: vi.fn(),
  runTransaction: (...args: unknown[]) => runTransaction(...args),
  serverTimestamp: () => 'SERVER_TIMESTAMP'
}));

import {
  MAX_DISPLAY_NAME_LENGTH,
  UsernameError,
  normalizeDisplayName,
  normalizeUsernameKey,
  reserveDisplayName
} from './username';

beforeEach(() => {
  runTransaction.mockClear();
});

describe('normalizeDisplayName', () => {
  it('räumt Leerzeichen auf', () => {
    expect(normalizeDisplayName('  Leon  ')).toBe('Leon');
    expect(normalizeDisplayName('Anna   Lena')).toBe('Anna Lena');
  });

  it('kürzt auf die in den Regeln erlaubte Länge', () => {
    expect(normalizeDisplayName('x'.repeat(200))).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
  });

  it('liefert für reine Leerzeichen einen leeren Namen', () => {
    expect(normalizeDisplayName('   ')).toBe('');
  });
});

describe('normalizeUsernameKey', () => {
  it('ignoriert Groß-/Kleinschreibung und Akzente', () => {
    expect(normalizeUsernameKey('Léon')).toBe('leon');
    expect(normalizeUsernameKey('LEON')).toBe('leon');
  });

  it('wandelt Leerzeichen in Bindestriche', () => {
    expect(normalizeUsernameKey('Anna Lena')).toBe('anna-lena');
  });

  it('liefert für reine Leerzeichen/Sonderzeichen einen leeren Schlüssel', () => {
    expect(normalizeUsernameKey('   ')).toBe('');
    expect(normalizeUsernameKey('!!!')).toBe('');
  });
});

describe('reserveDisplayName', () => {
  it('legt users/{uid} und usernames/{key} gemeinsam in einer Transaktion an', async () => {
    const set = vi.fn();
    const get = vi.fn().mockResolvedValue({ exists: () => false });
    runTransaction.mockImplementation(async (_db: unknown, updateFn: (tx: unknown) => Promise<void>) => {
      await updateFn({ get, set });
    });

    const name = await reserveDisplayName('uid-1', 'leon@example.com', '  Leon  ');

    expect(name).toBe('Leon');
    expect(set).toHaveBeenCalledTimes(2);
    const [usernameCall, userCall] = set.mock.calls;
    expect((usernameCall[0] as { path: string }).path).toBe('usernames/leon');
    expect(usernameCall[1]).toEqual({ uid: 'uid-1', createdAt: 'SERVER_TIMESTAMP' });
    expect((userCall[0] as { path: string }).path).toBe('users/uid-1');
    expect(userCall[1]).toEqual({
      displayName: 'Leon',
      email: 'leon@example.com',
      createdAt: 'SERVER_TIMESTAMP'
    });
  });

  it('wirft nameTaken, wenn der Name bereits reserviert ist', async () => {
    const get = vi.fn().mockResolvedValue({ exists: () => true });
    runTransaction.mockImplementation(async (_db: unknown, updateFn: (tx: unknown) => Promise<void>) => {
      await updateFn({ get, set: vi.fn() });
    });

    await expect(reserveDisplayName('uid-2', 'leon2@example.com', 'Leon')).rejects.toMatchObject({
      code: 'nameTaken' satisfies UsernameError['code']
    });
  });

  it('wirft invalidName für einen leeren Namen, ohne die Transaktion zu starten', async () => {
    await expect(reserveDisplayName('uid-3', 'x@example.com', '   ')).rejects.toMatchObject({
      code: 'invalidName'
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
