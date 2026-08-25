import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  fakeFirestoreModule,
  readFakeCollection,
  readFakeDoc,
  resetFakeFirestore,
  seedFakeDoc
} from '../test/fakeFirestore';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui';
import { LivePosition } from '../types';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());

const roadtrip = {
  tripId: 'sommertour',
  displayName: 'Skipper',
  role: 'owner' as string | null,
  authUser: { uid: 'uid-skipper' } as { uid: string } | null
};
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const tracking: { position: LivePosition | null } = {
  position: { lat: 41.7151, lng: 44.8271, speedKmh: 0, headingDeg: null }
};
vi.mock('../hooks/useTracking', () => ({ useTracking: () => tracking }));

const Toilets = (await import('./Toilets')).default;

const STOPS_PATH = 'roadtrips/sommertour/toiletStops';
const DETAILS_PATH = 'roadtrips/sommertour/toiletDetails';

const NOW = new Date(2026, 7, 20, 9, 30).getTime();

/** Ein Stopp samt Beschreibung, so wie ihn die App ablegt. */
function seedStop(
  id: string,
  options: {
    author?: string;
    authorId?: string;
    timestamp?: number;
    bristolType?: number | null;
    deletedAt?: number;
  } = {}
) {
  const { author = 'Skipper', authorId = 'uid-skipper', timestamp = NOW, bristolType = 4 } = options;
  seedFakeDoc(`${STOPS_PATH}/${id}`, {
    timestamp,
    author,
    authorId,
    lat: 41.7,
    lng: 44.8,
    placeType: 'gasStation',
    ...(options.deletedAt ? { deletedAt: options.deletedAt } : {})
  });
  if (bristolType !== null) seedFakeDoc(`${DETAILS_PATH}/${id}`, { authorId, bristolType });
}

/** Wert einer Kennzahl-Kachel, z.B. „Stopps der Crew". */
function tileValue(label: string): string {
  const tile = screen.getByText(label).closest('.stat-tile') as HTMLElement;
  return tile.querySelector('.stat-tile-value')?.textContent ?? '';
}

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  roadtrip.role = 'owner';
  roadtrip.authUser = { uid: 'uid-skipper' };
  tracking.position = { lat: 41.7151, lng: 44.8271, speedKmh: 0, headingDeg: null };
  localStorage.clear();
  // Sprache festnageln: sonst hinge der Test an der Browsersprache von jsdom.
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de' }));
  resetFakeFirestore();
  resetOfflineAreasCache();

  // Leaflet braucht in jsdom eine Containergröße, sonst wirft die Karte.
  for (const [prop, value] of [
    ['clientWidth', 800],
    ['clientHeight', 600],
    ['offsetWidth', 800],
    ['offsetHeight', 600]
  ] as const) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value });
    sizeSpies.push(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
    });
  }
});

afterEach(() => {
  for (const restore of sizeSpies) restore();
  sizeSpies = [];
  localStorage.clear();
  resetFakeFirestore();
  resetOfflineAreasCache();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/toiletten']}>
          <ToastProvider>{children}</ToastProvider>
        </MemoryRouter>
      </I18nProvider>
    </PreferencesProvider>
  );
}

describe('Toiletten', () => {
  it('trägt einen Stopp an der aktuellen Position ein', async () => {
    render(<Toilets />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('Beschreibung (Bristol-Skala)'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Örtlichkeit'), { target: { value: 'nature' } });
    fireEvent.click(screen.getByRole('button', { name: /Hier eintragen/ }));

    await waitFor(() => expect(readFakeCollection(STOPS_PATH)).toHaveLength(1));
    const [stop] = readFakeCollection(STOPS_PATH);
    expect(stop.data).toMatchObject({
      author: 'Skipper',
      authorId: 'uid-skipper',
      lat: 41.7151,
      lng: 44.8271,
      placeType: 'nature'
    });
  });

  it('legt die Beschreibung getrennt vom Marker ab', async () => {
    render(<Toilets />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('Beschreibung (Bristol-Skala)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Hier eintragen/ }));

    await waitFor(() => expect(readFakeCollection(DETAILS_PATH)).toHaveLength(1));
    const [stop] = readFakeCollection(STOPS_PATH);
    // Der Marker ist für die ganze Crew lesbar – deshalb darf die
    // Beschreibung dort nicht mitfahren (siehe firestore.rules).
    expect(stop.data).not.toHaveProperty('bristolType');
    // Beide tragen dieselbe Id, sonst fänden sie nicht mehr zueinander.
    expect(readFakeDoc(`${DETAILS_PATH}/${stop.id}`)).toEqual({
      authorId: 'uid-skipper',
      bristolType: 6
    });
  });

  it('zählt die Stopps der Crew und die eigenen getrennt', () => {
    seedStop('a');
    seedStop('b', { author: 'Anna', authorId: 'uid-anna', bristolType: 7 });
    seedStop('c', { author: 'Anna', authorId: 'uid-anna', timestamp: NOW + 86_400_000, bristolType: 1 });

    render(<Toilets />, { wrapper: Wrapper });

    expect(tileValue('Stopps der Crew')).toBe('3');
    expect(tileValue('Deine Stopps')).toBe('1');
    // Drei Stopps an zwei Kalendertagen.
    expect(tileValue('Ø pro Reisetag')).toBe('1,5');
  });

  it('lässt fremde Beschreibungen aus der eigenen Verteilung heraus', () => {
    seedStop('a', { bristolType: 4 });
    seedStop('b', { author: 'Anna', authorId: 'uid-anna', bristolType: 7 });

    render(<Toilets />, { wrapper: Wrapper });

    // Beide Marker zählen mit, beschrieben ist für dieses Konto nur einer.
    expect(tileValue('Stopps der Crew')).toBe('2');
    expect(screen.getByText(/Häufigster Typ/).textContent).toContain('Typ 4');
    // Nur in der Verteilung suchen: Dieselben sieben Beschriftungen stehen
    // auch im Dropdown zum Eintragen.
    const section = screen.getByText('Deine Verteilung').closest('.section') as HTMLElement;
    const soft = within(section)
      .getByText('Typ 7 · Flüssig, ohne feste Teile')
      .closest('.stat-bar') as HTMLElement;
    expect(soft.querySelector('.stat-bar-value')?.textContent).toBe('0');
  });

  it('übergeht, was im Papierkorb liegt', () => {
    seedStop('a');
    seedStop('b', { deletedAt: NOW + 1000 });

    render(<Toilets />, { wrapper: Wrapper });

    expect(tileValue('Stopps der Crew')).toBe('1');
  });

  it('erklärt die leere Karte, solange nichts eingetragen ist', () => {
    render(<Toilets />, { wrapper: Wrapper });
    expect(screen.getByText('Noch kein Stopp eingetragen')).toBeTruthy();
  });

  it('schaltet den Setzmodus um, wenn kein GPS anliegt', () => {
    tracking.position = null;
    render(<Toilets />, { wrapper: Wrapper });

    // Ohne Position bleibt „Hier eintragen" gesperrt – der Weg über die Karte
    // steht trotzdem offen.
    expect(screen.getByRole('button', { name: /Hier eintragen/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Auf Karte setzen/ }));
    expect(screen.getByRole('button', { name: /Setzen beenden/ })).toBeTruthy();
    expect(screen.getByText(/Ein Tipp auf die Karte/)).toBeTruthy();
  });

  it('bietet Read-only kein Eintragen an', () => {
    roadtrip.role = 'readonly';
    render(<Toilets />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /Hier eintragen/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Auf Karte setzen/ })).toBeDisabled();
  });
});
