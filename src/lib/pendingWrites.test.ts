import { afterEach, describe, expect, it } from 'vitest';
import {
  trackWrite,
  getPendingWriteCount,
  subscribePendingWrites,
  __resetPendingWritesForTests
} from './pendingWrites';

afterEach(() => {
  __resetPendingWritesForTests();
});

/** Wartet einen Tick, damit .then()/.catch()-Callbacks abgearbeitet werden. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('trackWrite', () => {
  it('zählt hoch, während das Promise offen ist, und wieder runter nach Erfolg', async () => {
    let resolveWrite: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });

    trackWrite(pending);
    expect(getPendingWriteCount()).toBe(1);

    resolveWrite!();
    await flush();
    expect(getPendingWriteCount()).toBe(0);
  });

  it('zählt auch bei einem fehlschlagenden Write wieder runter', async () => {
    let rejectWrite: (err: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectWrite = reject;
    });

    const tracked = trackWrite(pending);
    expect(getPendingWriteCount()).toBe(1);

    rejectWrite!(new Error('offline'));
    await tracked.catch(() => undefined);
    expect(getPendingWriteCount()).toBe(0);
  });

  it('zählt mehrere gleichzeitig offene Writes korrekt', async () => {
    let resolveA: () => void;
    let resolveB: () => void;
    const a = trackWrite(new Promise<void>((resolve) => (resolveA = resolve)));
    const b = trackWrite(new Promise<void>((resolve) => (resolveB = resolve)));

    expect(getPendingWriteCount()).toBe(2);

    resolveA!();
    await a;
    expect(getPendingWriteCount()).toBe(1);

    resolveB!();
    await b;
    expect(getPendingWriteCount()).toBe(0);
  });

  it('gibt das Original-Promise unverändert durch', async () => {
    const value = await trackWrite(Promise.resolve('ok'));
    expect(value).toBe('ok');
  });

  it('benachrichtigt Subscriber bei jeder Änderung', async () => {
    const calls: number[] = [];
    const unsubscribe = subscribePendingWrites(() => calls.push(getPendingWriteCount()));

    let resolveWrite: () => void;
    const tracked = trackWrite(new Promise<void>((resolve) => (resolveWrite = resolve)));
    resolveWrite!();
    await tracked;

    expect(calls).toEqual([1, 0]);
    unsubscribe();
  });
});
