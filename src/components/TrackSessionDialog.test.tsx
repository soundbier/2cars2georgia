import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { fakeFirestoreModule, readFakeCollection, resetFakeFirestore } from '../test/fakeFirestore';
import { GpsPoint } from '../types';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());

const roadtrip = { tripId: 'sommertour' as string | null, authUser: { uid: 'uid-skipper' } };
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const { TrackSessionDialog } = await import('./TrackSessionDialog');
const { PreferencesProvider } = await import('../hooks/usePreferences');
const { I18nProvider } = await import('../i18n');
const { ToastProvider } = await import('./ui');

const NOW = 1_770_000_000_000;
const SESSION = { id: 'session-1', startedAt: NOW, endedAt: NOW + 600_000 };
const SESSIONS_PATH = 'roadtrips/sommertour/trackSessions';

function point(overrides: Partial<GpsPoint>): GpsPoint {
  return {
    timestamp: NOW,
    author: 'Skipper',
    lat: 52.52,
    lng: 13.405,
    speedKmh: 10,
    headingDeg: 90,
    ...overrides
  };
}

const RECORDED: GpsPoint[] = [
  point({ timestamp: NOW, sessionId: 'session-1' }),
  point({ timestamp: NOW + 600_000, lat: 52.53, sessionId: 'session-1' }),
  // Gehört zu einer früheren Fahrt und darf hier nicht mitzählen.
  point({ timestamp: NOW - 60_000, sessionId: 'session-0' })
];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </PreferencesProvider>
  );
}

function renderDialog(points: GpsPoint[], onClose = vi.fn()) {
  render(<TrackSessionDialog session={SESSION} points={points} author="Skipper" onClose={onClose} />, {
    wrapper
  });
  return onClose;
}

beforeEach(() => {
  resetFakeFirestore();
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de', unitSystem: 'metric' }));
});

describe('TrackSessionDialog', () => {
  it('bleibt geschlossen, solange keine Aufzeichnung wartet', () => {
    render(<TrackSessionDialog session={null} points={[]} author="Skipper" onClose={vi.fn()} />, {
      wrapper
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('schlägt einen Namen vor und zeigt nur die Zahlen dieser Aufzeichnung', () => {
    renderDialog(RECORDED);

    const field = screen.getByLabelText('Name der Fahrt') as HTMLInputElement;
    expect(field.value).toMatch(/^Fahrt \d{2}\.\d{2}\.?, \d{2}:\d{2}$/);
    // Zwei eigene Punkte, der Punkt der früheren Fahrt zählt nicht mit.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0h 10m')).toBeInTheDocument();
  });

  it('speichert die Aufzeichnung unter ihrer sessionId', async () => {
    const onClose = renderDialog(RECORDED);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Name der Fahrt'));
    await user.type(screen.getByLabelText('Name der Fahrt'), '  Passau – Linz  ');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(readFakeCollection(SESSIONS_PATH)).toHaveLength(1));
    expect(readFakeCollection(SESSIONS_PATH)[0]).toEqual({
      id: 'session-1',
      // Führende und folgende Leerzeichen gehören nicht zum Namen.
      data: {
        name: 'Passau – Linz',
        startedAt: SESSION.startedAt,
        endedAt: SESSION.endedAt,
        author: 'Skipper',
        authorId: 'uid-skipper'
      }
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('lässt einen leeren Namen nicht speichern', async () => {
    renderDialog(RECORDED);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Name der Fahrt'));

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('schließt ohne Namen, ohne etwas anzulegen', async () => {
    const onClose = renderDialog(RECORDED);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ohne Namen' }));

    expect(readFakeCollection(SESSIONS_PATH)).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('bietet ohne aufgezeichnete Punkte nichts zum Benennen an', () => {
    renderDialog([]);

    expect(screen.queryByLabelText('Name der Fahrt')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });
});
