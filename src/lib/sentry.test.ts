import { beforeEach, describe, expect, it, vi } from 'vitest';

const setUser = vi.fn();
const setTag = vi.fn();
const init = vi.fn();

vi.mock('@sentry/react', () => ({ init, setUser, setTag }));

const { setSentryContext } = await import('./sentry');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setSentryContext', () => {
  it('sendet die pseudonyme UID, nie den Anzeigenamen', () => {
    // Der Kern der Zusage im Datenschutzhinweis: An Sentry – einen Dienst
    // außerhalb der App – geht kein Klarname.
    setSentryContext('sommertour-2026', 'uid-2');

    expect(setUser).toHaveBeenCalledWith({ id: 'uid-2' });
    expect(setTag).toHaveBeenCalledWith('roadtrip', 'sommertour-2026');
    expect(setTag).not.toHaveBeenCalledWith('crewUser', expect.anything());
  });

  it('räumt Konto und Roadtrip nach dem Abmelden wieder ab', () => {
    setSentryContext(null, null);

    expect(setUser).toHaveBeenCalledWith(null);
    expect(setTag).toHaveBeenCalledWith('roadtrip', undefined);
  });
});
