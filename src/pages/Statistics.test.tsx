import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { fakeFirestoreModule, resetFakeFirestore, seedFakeDoc } from '../test/fakeFirestore';
import { PreferencesProvider } from '../hooks/usePreferences';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());
vi.mock('../hooks/useRoadtrip', () => ({
  useRoadtrip: () => ({ tripId: 'sommertour', displayName: 'Skipper', role: 'owner' }),
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

const Statistics = (await import('./Statistics')).default;

const TRACK_PATH = 'roadtrips/sommertour/track';
const EVENTS_PATH = 'roadtrips/sommertour/events';
const SESSIONS_PATH = 'roadtrips/sommertour/trackSessions';

/* Feste Ortszeit statt Date.now(): Die Auswertung gruppiert nach
   Kalendertagen der Geräte-Zeitzone, ein Test um Mitternacht soll trotzdem
   dasselbe Ergebnis liefern. */
const DAY_ONE = new Date(2026, 4, 4, 10, 0).getTime();
const DAY_TWO = new Date(2026, 4, 5, 10, 0).getTime();

/** Ein Hundertstel Breitengrad sind rund 1,11 km. */
const STEP = 0.01;

function seedPoint(
  id: string,
  timestamp: number,
  latOffset: number,
  speedKmh: number,
  options: { author?: string; sessionId?: string } = {}
) {
  seedFakeDoc(`${TRACK_PATH}/${id}`, {
    timestamp,
    lat: 52 + latOffset * STEP,
    lng: 13,
    speedKmh,
    headingDeg: 0,
    author: options.author ?? 'Skipper',
    ...(options.sessionId ? { sessionId: options.sessionId } : {})
  });
}

/**
 * Zwei Reisetage: am ersten zwei Stunden und rund 2,2 km unter der
 * Aufzeichnung „Etappe 1", am zweiten eine Stunde und rund 1,1 km ohne
 * benannte Aufzeichnung.
 */
function seedTwoDays() {
  seedPoint('a1', DAY_ONE, 0, 10, { sessionId: 'etappe-1' });
  seedPoint('a2', DAY_ONE + 3_600_000, 1, 24, { sessionId: 'etappe-1' });
  seedPoint('a3', DAY_ONE + 7_200_000, 2, 12, { sessionId: 'etappe-1' });
  seedPoint('b1', DAY_TWO, 10, 8);
  seedPoint('b2', DAY_TWO + 3_600_000, 11, 9);
  seedFakeDoc(`${SESSIONS_PATH}/etappe-1`, {
    name: 'Etappe 1',
    startedAt: DAY_ONE,
    endedAt: DAY_ONE + 7_200_000,
    author: 'Skipper',
    authorId: 'uid-skipper'
  });
}

beforeEach(() => {
  localStorage.clear();
  // Sprache festnageln: sonst hinge der Test an der Browsersprache von jsdom.
  localStorage.setItem('boat_preferences', JSON.stringify({ language: 'de' }));
  resetFakeFirestore();
});

afterEach(() => {
  localStorage.clear();
  resetFakeFirestore();
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/statistik']}>
          <ToastProvider>{children}</ToastProvider>
        </MemoryRouter>
      </I18nProvider>
    </PreferencesProvider>
  );
}

/** Der Wert, der über einer Kennzahl-Beschriftung im Kachelraster steht. */
function tileValue(label: string): string {
  const grid = document.querySelector('.stat-grid') as HTMLElement;
  const tile = within(grid).getByText(label).closest('.stat-tile');
  return tile?.querySelector('.stat-tile-value')?.textContent ?? '';
}

describe('Statistik', () => {
  it('zeigt einen Leer-Hinweis, solange nichts aufgezeichnet wurde', () => {
    render(<Statistics />, { wrapper: Wrapper });

    expect(screen.getByText('Nichts auszuwerten')).toBeTruthy();
  });

  it('wertet den gesamten Roadtrip aus', () => {
    seedTwoDays();
    render(<Statistics />, { wrapper: Wrapper });

    // 4 Schritte à ~1,11 km, aber der Sprung zwischen den beiden Tagen zählt
    // nicht mit: 2,22 km am ersten Tag, 1,11 km am zweiten – dazwischen liegt
    // ein Sprung von 8 Schritten, der als Strecke der Gesamtspur mitgeht.
    expect(tileValue('Strecke')).toMatch(/km$/);
    expect(tileValue('Höchsttempo')).toBe('24.0 km/h');
    expect(tileValue('Trackpunkte')).toBe('5');
    // Zwei Tage mit mehr als einem Punkt.
    expect(tileValue('Reisetage')).toBe('2');
  });

  it('trennt die Strecke nach Crewmitglied', () => {
    seedTwoDays();
    seedPoint('c1', DAY_TWO + 60_000, 40, 10, { author: 'Bootsmann' });
    seedPoint('c2', DAY_TWO + 3_660_000, 41, 10, { author: 'Bootsmann' });
    render(<Statistics />, { wrapper: Wrapper });

    const crew = screen.getByText('Crew').closest('.section') as HTMLElement;
    expect(within(crew).getByText('Skipper')).toBeTruthy();
    // Ein einzelner Schritt: kein Sprung quer über die Landkarte, weil die
    // Punkte der beiden Personen ineinander liegen.
    expect(within(crew).getByText('1.1 km')).toBeTruthy();
  });

  it('zählt die Logbuch-Ereignisse je Kategorie und lässt den Papierkorb aus', () => {
    seedTwoDays();
    for (const [id, type] of [
      ['e1', 'pause'],
      ['e2', 'pause'],
      ['e3', 'schleuse']
    ]) {
      seedFakeDoc(`${EVENTS_PATH}/${id}`, {
        timestamp: DAY_ONE + 600_000,
        author: 'Skipper',
        type,
        title: type,
        lat: 52,
        lng: 13
      });
    }
    seedFakeDoc(`${EVENTS_PATH}/e4`, {
      timestamp: DAY_ONE + 700_000,
      author: 'Skipper',
      type: 'pause',
      title: 'gelöscht',
      lat: 52,
      lng: 13,
      deletedAt: DAY_TWO
    });

    render(<Statistics />, { wrapper: Wrapper });

    // Drei aktive Ereignisse, das vierte liegt im Papierkorb.
    expect(tileValue('Trackpunkte')).toBe('5');
    expect(screen.getByText('3 Ereignisse')).toBeTruthy();
    const events = screen.getByText('Ereignisse', { selector: '.section-title' }).closest(
      '.section'
    ) as HTMLElement;
    expect(within(events).getByText('Pause')).toBeTruthy();
    expect(within(events).getByText('Schleuse')).toBeTruthy();
  });

  it('schaltet über die Tagesliste auf einen einzelnen Tag um', () => {
    seedTwoDays();
    render(<Statistics />, { wrapper: Wrapper });

    const days = screen.getByText('Tage im Vergleich').closest('.section') as HTMLElement;
    // Neuester Tag zuerst – der zweite Tag mit seinem einen Schritt.
    fireEvent.click(within(days).getAllByRole('button')[0]);

    // Der Ausschnitt oben steht jetzt auf „Tag", mit Auswahl daneben.
    expect(screen.getByRole('radio', { name: 'Tag' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Tag wählen')).toBeTruthy();
    expect(tileValue('Trackpunkte')).toBe('2');
    expect(tileValue('Strecke')).toBe('1.1 km');
    // Ohne die zweite Fahrt gibt es auch keine Rangliste mehr.
    expect(screen.queryByText('Aufgezeichnete Fahrten')).toBeNull();
  });

  it('zeigt Ereignisse auch dann, wenn an dem Tag nichts aufgezeichnet wurde', () => {
    seedFakeDoc(`${EVENTS_PATH}/e1`, {
      timestamp: DAY_ONE,
      author: 'Skipper',
      type: 'schleuse',
      title: 'Schleuse Kachlet',
      lat: 52,
      lng: 13
    });

    render(<Statistics />, { wrapper: Wrapper });

    // Keine Spur, aber etwas zu zeigen – der Leer-Hinweis wäre hier falsch.
    expect(screen.queryByText('Nichts auszuwerten')).toBeNull();
    expect(tileValue('Strecke')).toBe('0.0 km');
    expect(screen.getByText('1 Ereignis')).toBeTruthy();
    // Ohne Trackpunkte bleibt der Geschwindigkeitsabschnitt weg.
    expect(screen.queryByText('Verteilung')).toBeNull();
  });

  it('wertet eine einzelne Aufzeichnung aus', () => {
    seedTwoDays();
    render(<Statistics />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('radio', { name: 'Fahrt' }));

    expect((screen.getByLabelText('Fahrt wählen') as HTMLSelectElement).value).toBe('etappe-1');
    // Nur die drei Punkte mit dieser Kennung, nicht der Rest der Spur.
    expect(tileValue('Trackpunkte')).toBe('3');
    expect(tileValue('Strecke')).toBe('2.2 km');
    expect(tileValue('Zeitraum')).toBe('2h 0m');
  });
});
