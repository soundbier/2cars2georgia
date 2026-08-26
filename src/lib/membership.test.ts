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
  approveJoinRequest,
  createRoadtrip,
  deleteRoadtripCascade,
  joinTripId,
  rejectJoinRequest,
  removeMember,
  requestJoin,
  slugifyTripName,
  updateMemberRole,
  withdrawJoinRequest
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

describe('joinTripId', () => {
  it('nimmt eine ID unverändert', () => {
    expect(joinTripId('  sommertour-2026 ')).toBe('sommertour-2026');
  });

  it('bildet aus dem sichtbaren Namen denselben Slug wie beim Anlegen', () => {
    expect(joinTripId('Sommertour 2026')).toBe('sommertour-2026');
  });
});

describe('requestJoin', () => {
  it('stellt einen Antrag und liefert den Namen des Roadtrips', async () => {
    getDoc
      // Eigene Mitgliedschaft: noch keine.
      .mockResolvedValueOnce({ exists: () => false })
      // Eigener Antrag: noch keiner.
      .mockResolvedValueOnce({ exists: () => false })
      // Der Roadtrip – lesbar, weil der Antrag jetzt steht.
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });
    setDoc.mockResolvedValue(undefined);

    const result = await requestJoin('uid-2', 'Niklas', 'sommertour-2026');

    expect(result).toEqual({
      tripId: 'sommertour-2026',
      tripName: 'Sommertour 2026',
      alreadyMember: false
    });
    const [requestRef, requestData] = setDoc.mock.calls[0];
    expect((requestRef as { path: string }).path).toBe(
      'roadtrips/sommertour-2026/joinRequests/uid-2'
    );
    expect(requestData).toEqual({ displayName: 'Niklas', requestedAt: 'SERVER_TIMESTAMP' });
  });

  it('trägt niemanden selbst als Mitglied ein', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });
    setDoc.mockResolvedValue(undefined);

    await requestJoin('uid-2', 'Niklas', 'sommertour-2026');

    const written = setDoc.mock.calls.map(([ref]) => (ref as { path: string }).path);
    expect(written).not.toContain('roadtrips/sommertour-2026/members/uid-2');
  });

  it('räumt den Antrag wieder weg, wenn es den Roadtrip nicht gibt', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => false });
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);

    await expect(requestJoin('uid-2', 'Niklas', 'unbekannt')).rejects.toMatchObject({
      code: 'tripNotFound'
    });
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'roadtrips/unbekannt/joinRequests/uid-2' })
    );
  });

  it('schreibt nichts, wenn die Mitgliedschaft schon besteht', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'owner' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });

    const result = await requestJoin('uid-1', 'Leon', 'sommertour-2026');

    expect(result).toEqual({
      tripId: 'sommertour-2026',
      tripName: 'Sommertour 2026',
      alreadyMember: true
    });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('stellt keinen zweiten Antrag, wenn schon einer offen ist', async () => {
    getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ displayName: 'Niklas' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Sommertour 2026' }) });

    await requestJoin('uid-2', 'Niklas', 'sommertour-2026');

    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('approveJoinRequest / rejectJoinRequest / withdrawJoinRequest', () => {
  it('legt die Mitgliedschaft an und räumt den Antrag danach weg', async () => {
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);

    await approveJoinRequest('sommertour-2026', 'uid-2', 'Niklas');

    const [memberRef, memberData] = setDoc.mock.calls[0];
    expect((memberRef as { path: string }).path).toBe('roadtrips/sommertour-2026/members/uid-2');
    expect(memberData).toEqual({
      displayName: 'Niklas',
      role: 'member',
      joinedAt: 'SERVER_TIMESTAMP'
    });
    // Erst die Mitgliedschaft, dann der Antrag: Die Regel für members prüft,
    // dass der Antrag im Moment der Aufnahme noch existiert.
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'roadtrips/sommertour-2026/joinRequests/uid-2' })
    );
  });

  it('löscht beim Ablehnen und beim Zurückziehen nur den Antrag', async () => {
    deleteDoc.mockResolvedValue(undefined);

    await rejectJoinRequest('sommertour-2026', 'uid-2');
    await withdrawJoinRequest('sommertour-2026', 'uid-3');

    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc.mock.calls.map(([ref]) => (ref as { path: string }).path)).toEqual([
      'roadtrips/sommertour-2026/joinRequests/uid-2',
      'roadtrips/sommertour-2026/joinRequests/uid-3'
    ]);
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
