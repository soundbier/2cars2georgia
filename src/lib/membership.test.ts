import { describe, expect, it, vi, beforeEach } from 'vitest';

// Ohne diese Mocks würde der Import von ./membership eine echte Firebase-App
// initialisieren (src/firebase.ts) – die Tests brauchen weder Netz noch
// gültige Config.
vi.mock('../firebase', () => ({ auth: {}, db: {} }));

const getDoc = vi.fn();
const setDoc = vi.fn();
const deleteDoc = vi.fn();
const updateDoc = vi.fn();
const getDocs = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  query: (ref: unknown) => ref,
  getDoc: (...args: unknown[]) => getDoc(...args),
  getDocs: (...args: unknown[]) => getDocs(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
  deleteDoc: (...args: unknown[]) => deleteDoc(...args),
  updateDoc: (...args: unknown[]) => updateDoc(...args),
  writeBatch: () => ({ delete: batchDelete, commit: batchCommit }),
  serverTimestamp: () => 'SERVER_TIMESTAMP'
}));

import {
  createRoadtrip,
  deleteRoadtripCascade,
  joinRoadtrip,
  removeMember,
  slugifyTripName,
  updateMemberRole
} from './membership';

beforeEach(() => {
  vi.clearAllMocks();
  batchCommit.mockResolvedValue(undefined);
});

describe('slugifyTripName', () => {
  it('macht aus einem Namen eine URL-taugliche ID', () => {
    expect(slugifyTripName('Sommertour 2026')).toBe('sommertour-2026');
    expect(slugifyTripName('Ärgerliche Fähre!')).toBe('argerliche-fahre');
  });

  it('liefert für reine Sonderzeichen eine leere ID', () => {
    expect(slugifyTripName('!!!')).toBe('');
  });
});

describe('createRoadtrip', () => {
  it('legt Roadtrip, Owner-Mitgliedschaft und Reisezeitraum nacheinander an', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    setDoc.mockResolvedValue(undefined);

    const result = await createRoadtrip('uid-1', 'Leon', 'Sommertour 2026', '2026-07-01', '2026-07-20');

    expect(result.tripId).toBe('sommertour-2026');
    expect(result.tripName).toBe('Sommertour 2026');
    expect(setDoc).toHaveBeenCalledTimes(3);

    const [tripRef, tripData] = setDoc.mock.calls[0];
    expect((tripRef as { path: string }).path).toBe('roadtrips/sommertour-2026');
    expect(tripData).toEqual({ name: 'Sommertour 2026', ownerUid: 'uid-1', createdAt: 'SERVER_TIMESTAMP' });

    const [memberRef, memberData] = setDoc.mock.calls[1];
    expect((memberRef as { path: string }).path).toBe('roadtrips/sommertour-2026/members/uid-1');
    expect(memberData).toEqual({ displayName: 'Leon', role: 'owner', joinedAt: 'SERVER_TIMESTAMP' });

    const [, settingsData] = setDoc.mock.calls[2];
    expect(settingsData).toEqual({ startDate: '2026-07-01', endDate: '2026-07-20' });
  });

  it('lehnt ein ungültiges Reisedatum ab, ohne etwas zu schreiben', async () => {
    await expect(
      createRoadtrip('uid-1', 'Leon', 'Sommertour', '2026-07-20', '2026-07-01')
    ).rejects.toMatchObject({ code: 'invalidTripDates' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('räumt den Roadtrip-Datensatz auf, wenn die Owner-Mitgliedschaft fehlschlägt', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    setDoc.mockImplementationOnce(() => Promise.resolve()); // Roadtrip-Root
    setDoc.mockImplementationOnce(() => Promise.reject(new Error('denied'))); // Mitgliedschaft
    deleteDoc.mockResolvedValue(undefined);

    await expect(
      createRoadtrip('uid-1', 'Leon', 'Sommertour', '2026-07-01', '2026-07-20')
    ).rejects.toMatchObject({ code: 'unknown' });
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('joinRoadtrip', () => {
  it('tritt einem bestehenden Roadtrip als member bei', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) })
      .mockResolvedValueOnce({ exists: () => false });
    setDoc.mockResolvedValue(undefined);

    const result = await joinRoadtrip('uid-2', 'Niklas', 'sommertour-2026');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    const [memberRef, memberData] = setDoc.mock.calls[0];
    expect((memberRef as { path: string }).path).toBe('roadtrips/sommertour-2026/members/uid-2');
    expect(memberData).toEqual({ displayName: 'Niklas', role: 'member', joinedAt: 'SERVER_TIMESTAMP' });
  });

  it('findet den Roadtrip auch über den sichtbaren Namen statt der ID', async () => {
    getDoc
      // 'Sommertour 2026' als Dokument-ID: gibt es nicht …
      .mockResolvedValueOnce({ exists: () => false })
      // … der daraus gebildete Slug schon.
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) })
      .mockResolvedValueOnce({ exists: () => false });
    setDoc.mockResolvedValue(undefined);

    const result = await joinRoadtrip('uid-2', 'Niklas', '  Sommertour 2026 ');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    const [memberRef] = setDoc.mock.calls[0];
    expect((memberRef as { path: string }).path).toBe('roadtrips/sommertour-2026/members/uid-2');
  });

  it('wirft tripNotFound, wenn weder Eingabe noch Slug einen Roadtrip treffen', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await expect(joinRoadtrip('uid-2', 'Niklas', 'unbekannt')).rejects.toMatchObject({
      code: 'tripNotFound'
    });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('schreibt nichts, wenn die Mitgliedschaft schon existiert (Owner bleibt Owner)', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'owner' }) });

    const result = await joinRoadtrip('uid-1', 'Leon', 'sommertour-2026');

    expect(result).toEqual({ tripId: 'sommertour-2026', tripName: 'Sommertour 2026' });
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('updateMemberRole / removeMember', () => {
  it('schreibt nur die Rolle', async () => {
    await updateMemberRole('sommertour-2026', 'uid-2', 'readonly');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'roadtrips/sommertour-2026/members/uid-2' }),
      { role: 'readonly' }
    );
  });

  it('löscht das Mitgliedschafts-Dokument', async () => {
    await removeMember('sommertour-2026', 'uid-2');
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'roadtrips/sommertour-2026/members/uid-2' })
    );
  });
});

describe('deleteRoadtripCascade', () => {
  it('löscht Untercollections, dann fremde Mitglieder, dann Root, dann die eigene Mitgliedschaft', async () => {
    getDocs.mockImplementation((ref: { path: string }) => {
      if (ref.path.endsWith('/members')) {
        return Promise.resolve({
          docs: [
            { id: 'owner-uid', ref: { path: `${ref.path}/owner-uid` } },
            { id: 'uid-2', ref: { path: `${ref.path}/uid-2` } }
          ]
        });
      }
      return Promise.resolve({ docs: [] });
    });
    deleteDoc.mockResolvedValue(undefined);

    await deleteRoadtripCascade('sommertour-2026', 'owner-uid');

    // Fremdes Mitglied einzeln gelöscht, die eigene Owner-Mitgliedschaft nicht dabei.
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('uid-2') }));
    const deletedPaths = deleteDoc.mock.calls.map(([ref]) => (ref as { path: string }).path);
    // Der Roadtrip-Root wird vor der eigenen Mitgliedschaft gelöscht.
    const rootIndex = deletedPaths.indexOf('roadtrips/sommertour-2026');
    const ownMembershipIndex = deletedPaths.indexOf('roadtrips/sommertour-2026/members/owner-uid');
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(ownMembershipIndex).toBeGreaterThan(rootIndex);
  });
});
