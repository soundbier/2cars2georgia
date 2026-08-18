import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Signatur wie der echte addDoc-Aufruf in errorLog.ts – so kennt
// addDoc.mock.calls die Argumenttypen und die Tests kommen ohne Casts aus.
const addDoc = vi.fn((_ref: { path: string }, _entry: Record<string, unknown>) =>
  Promise.resolve({ id: 'doc-1' })
);

vi.mock('firebase/firestore', () => ({
  addDoc: (ref: { path: string }, entry: Record<string, unknown>) => addDoc(ref, entry),
  collection: (_db: unknown, path: string) => ({ path })
}));
vi.mock('../firebase', () => ({ db: {} }));

const { __resetErrorLogForTests, errorMessage, logError, setErrorLogContext } = await import('./errorLog');

/** Das geschriebene Dokument des n-ten Aufrufs. */
function writtenEntry(call = 0) {
  return addDoc.mock.calls[call][1];
}

beforeEach(() => {
  addDoc.mockClear();
  __resetErrorLogForTests();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorMessage', () => {
  it('liefert immer einen nicht-leeren Text', () => {
    expect(errorMessage(new Error('Kaputt'))).toBe('Kaputt');
    expect(errorMessage(new Error(''))).toBe('Error');
    expect(errorMessage('nur ein String')).toBe('nur ein String');
    expect(errorMessage(undefined)).toBe('Unbekannter Fehler');
  });

  it('kürzt auf die in den Regeln erlaubte Länge', () => {
    expect(errorMessage(new Error('x'.repeat(2000)))).toHaveLength(1000);
  });
});

describe('logError', () => {
  it('schreibt nichts ohne angemeldeten Roadtrip', () => {
    logError(new Error('Kaputt'));
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('schreibt in die errors-Collection des Roadtrips', () => {
    setErrorLogContext('sommertour-2026', 'Lukas');
    logError(new Error('Kaputt'), 'react');

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][0]).toEqual({ path: 'roadtrips/sommertour-2026/errors' });
    const entry = writtenEntry();
    expect(entry.message).toBe('Kaputt');
    expect(entry.context).toBe('react');
    expect(entry.author).toBe('Lukas');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('lässt optionale Felder weg statt undefined zu schreiben', () => {
    setErrorLogContext('sommertour-2026', null);
    logError('nur ein String');
    expect(Object.values(writtenEntry())).not.toContain(undefined);
    expect(writtenEntry()).not.toHaveProperty('author');
    expect(writtenEntry()).not.toHaveProperty('stack');
  });

  it('wiederholt denselben Fehler nicht im Sekundentakt', () => {
    setErrorLogContext('sommertour-2026', 'Lukas');
    logError(new Error('Kaputt'), 'react');
    logError(new Error('Kaputt'), 'react');
    expect(addDoc).toHaveBeenCalledTimes(1);

    logError(new Error('Kaputt'), 'unhandledrejection');
    logError(new Error('Anderer Fehler'), 'react');
    expect(addDoc).toHaveBeenCalledTimes(3);
  });

  it('bleibt still, wenn schon das Protokollieren scheitert', async () => {
    addDoc.mockRejectedValueOnce(new Error('permission-denied'));
    setErrorLogContext('sommertour-2026', 'Lukas');
    expect(() => logError(new Error('Kaputt'))).not.toThrow();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
  });
});
