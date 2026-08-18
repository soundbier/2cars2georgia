import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPendingWriteCount, __resetPendingWritesForTests } from './pendingWrites';
import { isOfflineWriteError, writeOptimistically } from './writeOutcome';

function firestoreError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  __resetPendingWritesForTests();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isOfflineWriteError', () => {
  it('erkennt fehlende Verbindung', () => {
    expect(isOfflineWriteError(firestoreError('unavailable'))).toBe(true);
    expect(isOfflineWriteError(firestoreError('deadline-exceeded'))).toBe(true);
  });

  it('lässt echte Fehler echte Fehler bleiben', () => {
    expect(isOfflineWriteError(firestoreError('permission-denied'))).toBe(false);
    expect(isOfflineWriteError(new Error('irgendwas'))).toBe(false);
  });
});

describe('writeOptimistically', () => {
  it('kehrt sofort zurück und zählt den Schreibvorgang mit', async () => {
    let settle: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      settle = resolve;
    });

    writeOptimistically(promise, () => expect.unreachable());
    expect(getPendingWriteCount()).toBe(1);

    settle();
    await promise;
    await Promise.resolve();
    expect(getPendingWriteCount()).toBe(0);
  });

  it('meldet einen abgelehnten Schreibvorgang', async () => {
    const onFailure = vi.fn();
    writeOptimistically(Promise.reject(firestoreError('permission-denied')), onFailure);
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledTimes(1));
  });

  it('meldet keinen Fehler, wenn nur die Verbindung fehlt', async () => {
    const onFailure = vi.fn();
    const rejected = Promise.reject(firestoreError('unavailable'));
    writeOptimistically(rejected, onFailure);
    await vi.waitFor(() => expect(getPendingWriteCount()).toBe(0));
    expect(onFailure).not.toHaveBeenCalled();
  });
});
