import { describe, expect, it, vi } from 'vitest';

// Ohne diese Mocks würde der Import von ./crew eine echte Firebase-App
// initialisieren (src/firebase.ts) – die Tests brauchen weder Netz noch
// gültige Config. Die Firestore-Aufrufe werden nur auf ihre Form geprüft.
vi.mock('../firebase', () => ({ auth: {}, db: {} }));

const setDoc = vi.fn();

vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  onSnapshot: vi.fn(),
  arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
  setDoc: (...args: unknown[]) => setDoc(...args)
}));

import {
  MAX_CREW_NAME_LENGTH,
  addCrewMember,
  isCrewNameTaken,
  joiningRole,
  normalizeCrewName
} from './crew';

describe('normalizeCrewName', () => {
  it('räumt Leerzeichen auf', () => {
    expect(normalizeCrewName('  Leon  ')).toBe('Leon');
    expect(normalizeCrewName('Anna   Lena')).toBe('Anna Lena');
  });

  it('kürzt auf die in den Regeln erlaubte Länge', () => {
    expect(normalizeCrewName('x'.repeat(200))).toHaveLength(MAX_CREW_NAME_LENGTH);
  });

  it('liefert für reine Leerzeichen einen leeren Namen', () => {
    expect(normalizeCrewName('   ')).toBe('');
  });
});

describe('isCrewNameTaken', () => {
  it('erkennt denselben Namen unabhängig von Groß-/Kleinschreibung', () => {
    expect(isCrewNameTaken(['Leon', 'Elias'], 'leon')).toBe(true);
    expect(isCrewNameTaken(['Leon'], '  LEON ')).toBe(true);
  });

  it('lässt neue Namen durch', () => {
    expect(isCrewNameTaken(['Leon'], 'Niklas')).toBe(false);
    expect(isCrewNameTaken([], 'Leon')).toBe(false);
  });
});

describe('joiningRole', () => {
  it('macht die erste Person zum Owner', () => {
    expect(joiningRole([])).toBe('owner');
  });

  it('lässt alle weiteren als Mitfahrer beitreten', () => {
    expect(joiningRole(['Leon'])).toBe('member');
  });
});

describe('addCrewMember', () => {
  it('schreibt Name und Rolle zusammenführend in settings/general', () => {
    addCrewMember('sommertour-2026', 'Leon', 'owner');

    const [ref, data, options] = setDoc.mock.calls.at(-1)!;
    expect((ref as { path: string }).path).toBe('roadtrips/sommertour-2026/settings/general');
    // arrayUnion statt Überschreiben: Zwei Geräte, die gleichzeitig beitreten,
    // dürfen sich nicht gegenseitig aus der Liste werfen.
    expect(data).toEqual({ users: { __arrayUnion: ['Leon'] }, roles: { Leon: 'owner' } });
    // Ohne merge würde der erste Beitritt ein bestehendes Dokument ersetzen.
    expect(options).toEqual({ merge: true });
  });
});
