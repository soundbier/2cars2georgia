import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { fakeFirestoreModule, resetFakeFirestore, seedFakeDoc } from '../test/fakeFirestore';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());
const roadtrip = { tripId: 'sommertour', tripName: 'Sommertour', displayName: 'Skipper', role: 'owner' };
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const DayView = (await import('./DayView')).default;

const TRACK_PATH = 'roadtrips/sommertour/track';
const EVENTS_PATH = 'roadtrips/sommertour/events';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

/** 2. Februar 2026, 09:00 Uhr lokal – der Tag, auf den sich die Tests beziehen. */
const DAY_ONE = new Date(2026, 1, 2, 9, 0, 0).getTime();
/** Ein Tag später, damit es etwas zum Umschalten gibt. */
const DAY_TWO = new Date(2026, 1, 3, 9, 0, 0).getTime();

function seedPoint(id: string, timestamp: number, at: { lat: number; lng: number }) {
  seedFakeDoc(`${TRACK_PATH}/${id}`, {
    timestamp,
    author: 'Skipper',
    lat: at.lat,
    lng: at.lng,
    speedKmh: 10,
    headingDeg: 90
  });
}

function seedEvent(id: string, timestamp: number, title: string) {
  seedFakeDoc(`${EVENTS_PATH}/${id}`, {
    timestamp,
    author: 'Skipper',
    type: 'note',
    title,
    lat: PASSAU.lat,
    lng: PASSAU.lng
  });
}

/** Ein voller Fahrtag: zwei Punkte über eine Stunde, dazu ein Ereignis. */
function seedDay(prefix: string, start: number, title: string) {
  seedPoint(`${prefix}-1`, start, PASSAU);
  seedPoint(`${prefix}-2`, start + 3_600_000, LINZ);
  seedEvent(`${prefix}-e`, start + 1_800_000, title);
}

beforeEach(() => {
  // Die Oberfläche steht in den Tests auf Deutsch, sonst hinge jede
  // Zusicherung an der Sprache des Geräts.
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de' }));
});

afterEach(() => {
  resetFakeFirestore();
  localStorage.clear();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/settings/tagesansicht']}>
          <ToastProvider>{children}</ToastProvider>
        </MemoryRouter>
      </I18nProvider>
    </PreferencesProvider>
  );
}

describe('Tagesansicht', () => {
  it('zeigt Strecke, Fahrzeit und Ereignisse des jüngsten Tages', () => {
    seedDay('tag-1', DAY_ONE, 'Schleuse Jochenstein');
    seedDay('tag-2', DAY_TWO, 'Ankunft Linz');
    render(<DayView />, { wrapper: Wrapper });

    // Vorbelegt ist der jüngste Tag mit Spur, nicht der erste der Liste.
    const day = screen.getByLabelText('Tag') as HTMLSelectElement;
    expect(day.value).toBe('2026-02-03');

    expect(screen.getByText(/6\d[.,]\d\s*km/)).toBeTruthy();
    expect(screen.getByText('1h 0m')).toBeTruthy();
    expect(screen.getByText('Ankunft Linz')).toBeTruthy();
    // Der andere Tag steht zur Wahl, seine Ereignisse aber nicht in der Liste.
    expect(screen.queryByText('Schleuse Jochenstein')).toBeNull();
  });

  it('wechselt auf einen anderen Tag', () => {
    seedDay('tag-1', DAY_ONE, 'Schleuse Jochenstein');
    seedDay('tag-2', DAY_TWO, 'Ankunft Linz');
    render(<DayView />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: '2026-02-02' } });

    expect(screen.getByText('Schleuse Jochenstein')).toBeTruthy();
    expect(screen.queryByText('Ankunft Linz')).toBeNull();
  });

  it('rechnet ohne laufende Aufzeichnung – die Spur allein genügt', () => {
    // Keine trackSessions, kein aktiver Zustand: nur Punkte von gestern.
    seedPoint('p1', DAY_ONE, PASSAU);
    seedPoint('p2', DAY_ONE + 3_600_000, LINZ);
    render(<DayView />, { wrapper: Wrapper });

    expect(screen.getByText(/6\d[.,]\d\s*km/)).toBeTruthy();
    expect(screen.getByText('Keine Ereignisse an diesem Tag')).toBeTruthy();
  });

  it('lässt gelöschte Ereignisse aus dem Tag heraus', () => {
    seedDay('tag-1', DAY_ONE, 'Schleuse Jochenstein');
    seedFakeDoc(`${EVENTS_PATH}/weg`, {
      timestamp: DAY_ONE + 60_000,
      author: 'Skipper',
      type: 'note',
      title: 'Vertippt',
      lat: PASSAU.lat,
      lng: PASSAU.lng,
      deletedAt: DAY_ONE + 120_000
    });
    render(<DayView />, { wrapper: Wrapper });

    expect(screen.getByText('Schleuse Jochenstein')).toBeTruthy();
    expect(screen.queryByText('Vertippt')).toBeNull();
  });

  it('erklärt die leere Ansicht, solange nichts aufgezeichnet wurde', () => {
    render(<DayView />, { wrapper: Wrapper });
    expect(screen.getByText('Noch kein Tag mit Daten')).toBeTruthy();
    // Der Umschalter bleibt auch dann stehen – sonst käme man hier nicht weg.
    expect(screen.getByRole('link', { name: 'Routen' })).toBeTruthy();
  });

  it('führt über den Umschalter zu den anderen Bereichen', () => {
    render(<DayView />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: 'Allgemein' }).getAttribute('href')).toBe('/settings');
    expect(screen.getByRole('link', { name: 'Routen' }).getAttribute('href')).toBe(
      '/settings/routenplaner'
    );
    // Die eigene Seite ist als aktuelle Seite ausgezeichnet.
    expect(screen.getByRole('link', { name: 'Tagesansicht' }).getAttribute('aria-current')).toBe(
      'page'
    );
  });
});
