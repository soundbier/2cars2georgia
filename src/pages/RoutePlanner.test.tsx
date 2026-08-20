import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RoutePlanner from './RoutePlanner';
import {
  createRoute,
  createWaypoint,
  readPlannedRoutes,
  resetPlannedRoutesCache,
  setActiveRoute,
  setRouteWaypoints
} from '../lib/plannedRoute';
import { resetOfflineAreasCache } from '../lib/offlineTiles';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';

const PASSAU = { lat: 48.5667, lng: 13.4319 };
const LINZ = { lat: 48.3069, lng: 14.2858 };

let sizeSpies: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  // Sprache festnageln: sonst hinge der Test an der Browsersprache von jsdom.
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de' }));
  resetPlannedRoutesCache();
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
  resetPlannedRoutesCache();
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

    const store = readPlannedRoutes();
    expect(store.routes.map((route) => route.name)).toEqual(['Tag 3: Passau – Linz']);
    // Neu angelegte Routen sind sofort aktiv und offen zum Abstecken.
    expect(store.activeId).toBe(store.routes[0].id);
    expect(screen.getByText('Abstecken: Tag 3: Passau – Linz')).toBeTruthy();
  });

  it('listet gespeicherte Routen mit Tag, Wegpunkten und Länge', () => {
    const route = createRoute('Tag 1: Passau – Linz', '2026-05-04');
    setRouteWaypoints(route.id, [
      createWaypoint(PASSAU.lat, PASSAU.lng),
      createWaypoint(LINZ.lat, LINZ.lng)
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
    const day1 = createRoute('Tag 1', '2026-05-04');
    const day2 = createRoute('Tag 2', '2026-05-05');
    setActiveRoute(day2.id);

    render(<RoutePlanner />, { wrapper: Wrapper });

    const rows = screen.getAllByText(/^Tag [12]$/).map((el) => el.closest('.list-item') as HTMLElement);
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Für die Karte aktivieren' }));
    expect(readPlannedRoutes().activeId).toBe(day1.id);

    // Erneutes Antippen der aktiven Route gibt die Karte wieder dem Track frei.
    fireEvent.click(
      within(rows[0]).getByRole('button', { name: 'Nicht mehr auf der Karte verwenden' })
    );
    expect(readPlannedRoutes().activeId).toBeNull();
  });
});
