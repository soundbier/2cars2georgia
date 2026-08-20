import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  fakeFirestoreModule,
  readFakeCollection,
  resetFakeFirestore,
  seedFakeDoc
} from '../test/fakeFirestore';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => ({ tripId: 'sommertour', displayName: 'Skipper', role: 'owner' }),
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const RoutePlanner = (await import('./RoutePlanner')).default;
const { readActiveRouteId, resetActiveRouteCache, writeActiveRouteId } = await import(
  '../lib/plannedRoute'
);

const ROUTES_PATH = 'roadtrips/sommertour/plannedRoutes';

/** Eine fertige Route direkt im Roadtrip ablegen. */
function seedRoute(id: string, name: string, date: string, waypoints: Array<{ id: string; lat: number; lng: number }>) {
  seedFakeDoc(`${ROUTES_PATH}/${id}`, {
    name,
    date,
    waypoints,
    author: 'Skipper',
    updatedAt: 1_770_000_000_000
  });
}

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  // Sprache festnageln: sonst hinge der Test an der Browsersprache von jsdom.
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de' }));
  resetActiveRouteCache();
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
  resetActiveRouteCache();
  resetFakeFirestore();
  resetOfflineAreasCache();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>{children}</I18nProvider>
    </PreferencesProvider>
  );
}

describe('Routenplaner-Seite', () => {
  it('legt eine Tagesroute an und öffnet sie zum Abstecken', () => {
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.change(screen.getByPlaceholderText('Name, z. B. Tag 3: Passau – Linz'), {
      target: { value: 'Tag 3: Passau – Linz' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Route anlegen' }));

    // Die Route liegt im Roadtrip, nicht auf dem Gerät – jedes Crewmitglied
    // sieht sie.
    const stored = readFakeCollection(ROUTES_PATH);
    expect(stored.map((entry) => entry.data.name)).toEqual(['Tag 3: Passau – Linz']);
    // Neu angelegte Routen sind sofort aktiv und offen zum Abstecken.
    expect(readActiveRouteId()).toBe(stored[0].id);
    expect(screen.getByText('Abstecken: Tag 3: Passau – Linz')).toBeTruthy();
  });

  it('listet gespeicherte Routen mit Tag, Wegpunkten und Länge', () => {
    seedRoute('tag-1', 'Tag 1: Passau – Linz', '2026-05-04', [
      { id: 'a', ...PASSAU },
      { id: 'b', ...LINZ }
    ]);

    render(<RoutePlanner />, { wrapper: Wrapper });

    expect(screen.getByText('Tag 1: Passau – Linz')).toBeTruthy();
    // Tag, Wegpunktzahl und Länge (Passau – Linz, gut 60 km Luftlinie)
    // stehen in einer Zeile.
    const subtitle = screen.getByText(/Wegpunkte/).textContent ?? '';
    expect(subtitle).toMatch(/2 Wegpunkte/);
    expect(subtitle).toMatch(/6\d[.,]\d\s*km/);
  });

  it('schaltet die aktive Route um', () => {
    seedRoute('tag-1', 'Tag 1', '2026-05-04', [{ id: 'a', ...PASSAU }]);
    seedRoute('tag-2', 'Tag 2', '2026-05-05', [{ id: 'b', ...LINZ }]);
    writeActiveRouteId('tag-2');

    render(<RoutePlanner />, { wrapper: Wrapper });

    const rows = screen.getAllByText(/^Tag [12]$/).map((el) => el.closest('.list-item') as HTMLElement);
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Für die Karte aktivieren' }));
    expect(readActiveRouteId()).toBe('tag-1');

    // Erneutes Antippen der aktiven Route gibt die Karte wieder dem Track frei.
    fireEvent.click(
      within(rows[0]).getByRole('button', { name: 'Nicht mehr auf der Karte verwenden' })
    );
    expect(readActiveRouteId()).toBeNull();
  });
});
