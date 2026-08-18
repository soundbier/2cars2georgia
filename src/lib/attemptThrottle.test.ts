import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  msUntilUnlocked,
  recordAttemptFailure,
  recordAttemptSuccess,
  __resetAttemptThrottleForTests
} from './attemptThrottle';

beforeEach(() => {
  __resetAttemptThrottleForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('attemptThrottle', () => {
  it('sperrt nicht vor Erreichen der Fehlversuchs-Schwelle', () => {
    recordAttemptFailure();
    recordAttemptFailure();
    expect(msUntilUnlocked()).toBe(0);
  });

  it('sperrt ab der Schwelle für eine begrenzte Zeit', () => {
    vi.useFakeTimers();
    recordAttemptFailure();
    recordAttemptFailure();
    recordAttemptFailure();

    expect(msUntilUnlocked()).toBeGreaterThan(0);

    vi.advanceTimersByTime(60_000);
    expect(msUntilUnlocked()).toBe(0);
  });

  it('erhöht die Sperrzeit mit weiteren Fehlversuchen, gedeckelt', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) recordAttemptFailure();
    const firstDelay = msUntilUnlocked();

    vi.advanceTimersByTime(firstDelay);
    recordAttemptFailure();
    const secondDelay = msUntilUnlocked();

    expect(secondDelay).toBeGreaterThan(0);
    expect(secondDelay).toBeLessThanOrEqual(30_000);
  });

  it('setzt den Zähler nach einem Erfolg zurück', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) recordAttemptFailure();
    expect(msUntilUnlocked()).toBeGreaterThan(0);

    vi.advanceTimersByTime(60_000);
    recordAttemptSuccess();
    recordAttemptFailure();
    recordAttemptFailure();
    expect(msUntilUnlocked()).toBe(0);
  });
});
