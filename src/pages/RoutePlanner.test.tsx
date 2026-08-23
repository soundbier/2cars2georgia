import { ReactNode } from 'react';
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

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());
const roadtrip = { tripId: 'sommertour', displayName: 'Skipper', role: 'owner' as string | null };
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const RoutePlanner = (await import('./RoutePlanner')).default;
const { readActiveRouteId, resetActiveRouteCache, writeActiveRouteId } = await import(
  '../lib/plannedRoute'
);

const ROUTES_PATH = 'roadtrips/sommertour/plannedRoutes';
const SESSIONS_PATH = 'roadtrips/sommertour/trackSessions';
const TRACK_PATH = 'roadtrips/sommertour/track';

const NOW = 1_770_000_000_000;

/** Eine benannte Aufzeichnung samt zweier Punkte ablegen. */
function seedSession(id: string, name: string, startedAt: number) {
  seedFakeDoc(`${SESSIONS_PATH}/${id}`, {
    name,
    startedAt,
    endedAt: startedAt + 3_600_000,
    author: 'Skipper',
    authorId: 'uid-crew'
  });
  seedFakeDoc(`${TRACK_PATH}/${id}_1`, {
    timestamp: startedAt,
    author: 'Skipper',
    sessionId: id,
    lat: PASSAU.lat,
    lng: PASSAU.lng,
    speedKmh: 10,
    headingDeg: 90
  });
  seedFakeDoc(`${TRACK_PATH}/${id}_2`, {
    timestamp: startedAt + 3_600_000,
    author: 'Skipper',
    sessionId: id,
    lat: LINZ.lat,
    lng: LINZ.lng,
    speedKmh: 10,
    headingDeg: 90
  });
}

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
  roadtrip.role = 'owner';
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
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </PreferencesProvider>
  );
}

describe('Routenmenü', () => {
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

  it('benennt eine geplante Route über den Bearbeiten-Dialog um', () => {
    seedRoute('tag-1', 'Tag 1', '2026-05-04', []);
    render(<RoutePlanner />, { wrapper: Wrapper });

    // Umbenannt wird aus der Liste heraus – ohne dass die Karte aufgehen muss.
    fireEvent.click(screen.getByRole('button', { name: 'Route bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Name der Route'), {
      target: { value: 'Tag 1: Passau – Linz' }
    });
    fireEvent.change(screen.getByLabelText('Tag der Route'), { target: { value: '2026-05-05' } });

    // Solange der Dialog offen ist, ist nichts geschrieben.
    expect(readFakeDoc(`${ROUTES_PATH}/tag-1`)?.name).toBe('Tag 1');

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(readFakeDoc(`${ROUTES_PATH}/tag-1`)?.name).toBe('Tag 1: Passau – Linz');
    expect(readFakeDoc(`${ROUTES_PATH}/tag-1`)?.date).toBe('2026-05-05');
    expect(screen.queryByLabelText('Name der Route')).toBeNull();
  });

  it('verwirft die Änderung beim Abbrechen', () => {
    seedRoute('tag-1', 'Tag 1', '2026-05-04', []);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Route bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Name der Route'), { target: { value: 'Verschrieben' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(readFakeDoc(`${ROUTES_PATH}/tag-1`)?.name).toBe('Tag 1');
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

  it('legt eine geplante Route in den Papierkorb und holt sie zurück', async () => {
    seedRoute('tag-1', 'Tag 1', '2026-05-04', [
      { id: 'a', ...PASSAU },
      { id: 'b', ...LINZ }
    ]);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Route löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(screen.queryByText('Tag 1')).toBeNull());
    // Die Wegpunkte bleiben mit dem Dokument liegen, sonst wäre der Weg
    // zurück nur der Name.
    const [stored] = readFakeCollection(ROUTES_PATH);
    expect(stored.data).toMatchObject({ deletedAt: expect.any(Number) });
    expect((stored.data.waypoints as unknown[]).length).toBe(2);

    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));

    await waitFor(() => expect(screen.getByText('Tag 1')).toBeTruthy());
    expect(readFakeCollection(ROUTES_PATH)[0].data).not.toHaveProperty('deletedAt');
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

  it('listet gefahrene Aufzeichnungen mit Zeit, Dauer und Strecke', () => {
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    const row = screen.getByText('Fahrt 04.05., 09:30').closest('.list-item') as HTMLElement;
    const subtitle = row.querySelector('.list-item-subtitle')?.textContent ?? '';
    expect(subtitle).toMatch(/1h 0m/);
    // Passau – Linz, gut 60 km Luftlinie zwischen den beiden Punkten.
    expect(subtitle).toMatch(/6\d[.,]\d\s*km/);
    expect(subtitle).toMatch(/Skipper/);
  });

  it('benennt eine Aufzeichnung um, ohne ihre Aufzeichnung anzurühren', async () => {
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Fahrt umbenennen' }));
    fireEvent.change(screen.getByLabelText('Name der Fahrt'), {
      target: { value: 'Passau – Linz' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(readFakeDoc(`${SESSIONS_PATH}/session-1`)?.name).toBe('Passau – Linz')
    );
    const stored = readFakeDoc(`${SESSIONS_PATH}/session-1`);
    // Start, Ende und Autor sind Aufzeichnung und bleiben, wie sie waren –
    // auch die authorId der Person, die gefahren ist.
    expect(stored?.startedAt).toBe(NOW);
    expect(stored?.endedAt).toBe(NOW + 3_600_000);
    expect(stored?.author).toBe('Skipper');
    expect(stored?.authorId).toBe('uid-crew');
    // Die Punkte der Fahrt bleiben unberührt.
    expect(readFakeCollection(TRACK_PATH)).toHaveLength(2);
  });

  it('legt eine Aufzeichnung nach Rückfrage in den Papierkorb und lässt die Punkte liegen', async () => {
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Fahrt aus der Liste entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(screen.queryByText('Fahrt 04.05., 09:30')).toBeNull());
    // Das Dokument bleibt mit Zeitstempel liegen – der Papierkorb lebt davon.
    const [stored] = readFakeCollection(SESSIONS_PATH);
    expect(stored.data).toMatchObject({ name: 'Fahrt 04.05., 09:30', deletedAt: expect.any(Number) });
    // Die Spur selbst ist keine Beschriftung und bleibt in jedem Fall.
    expect(readFakeCollection(TRACK_PATH)).toHaveLength(2);
  });

  it('holt die entfernte Aufzeichnung über den Rückgängig-Toast zurück', async () => {
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Fahrt aus der Liste entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));

    await waitFor(() => expect(screen.getByText('Fahrt 04.05., 09:30')).toBeTruthy());
    expect(readFakeCollection(SESSIONS_PATH)[0].data).not.toHaveProperty('deletedAt');
  });

  it('lässt auch die Crew ohne Owner-Rolle eine Fahrt wegräumen', async () => {
    roadtrip.role = 'member';
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Fahrt aus der Liste entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    // Rückholbar ist der Schritt ohnehin; endgültig löschen darf nur der
    // Owner, und das erst im Papierkorb (firestore.rules).
    await waitFor(() =>
      expect(readFakeCollection(SESSIONS_PATH)[0].data).toMatchObject({
        deletedAt: expect.any(Number)
      })
    );
  });

  it('bietet Read-only weder Umbenennen noch Entfernen an', () => {
    roadtrip.role = 'readonly';
    seedSession('session-1', 'Fahrt 04.05., 09:30', NOW);
    render(<RoutePlanner />, { wrapper: Wrapper });

    expect(screen.getByText('Fahrt 04.05., 09:30')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fahrt umbenennen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fahrt aus der Liste entfernen' })).toBeNull();
  });

  it('erklärt die leere Liste, solange keine Fahrt benannt wurde', () => {
    render(<RoutePlanner />, { wrapper: Wrapper });
    expect(screen.getByText('Noch keine Fahrt gespeichert')).toBeTruthy();
  });
});
