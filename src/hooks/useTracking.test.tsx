import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { fakeFirestoreModule, readFakeCollection, resetFakeFirestore } from '../test/fakeFirestore';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => fakeFirestoreModule());

const roadtrip = { tripId: 'sommertour' as string | null, authUser: { uid: 'uid-1' } };
vi.mock('./useRoadtrip', () => ({
  useRoadtrip: () => roadtrip,
  tripPath: (tripId: string, ...segments: string[]) => ['roadtrips', tripId, ...segments].join('/')
}));

// Aufzeichnungsintervall 0: Jeder Fix im Test soll auch ein Punkt werden.
vi.mock('./usePreferences', () => ({
  usePreferences: () => ({ preferences: { trackIntervalMs: 0, keepScreenAwake: false } })
}));

vi.mock('../i18n', () => ({ useT: () => (key: string) => key }));

const { TrackingProvider, useTracking } = await import('./useTracking');
const { getQueuedCount, readQueuedPoints, __resetTrackBufferForTests } = await import(
  '../lib/trackBuffer'
);
const { __resetTrackUploaderForTests } = await import('../lib/trackUploader');
const firestore = await import('firebase/firestore');

const TRACK_PATH = 'roadtrips/sommertour/track';
const SESSION_KEY = 'boat_active_track_session';

/** Der zuletzt registrierte Geolocation-Callback – so kommen Fixes in den Test. */
let sendFix: ((position: { coords: Partial<GeolocationCoordinates> }) => void) | null = null;

beforeEach(async () => {
  resetFakeFirestore();
  localStorage.clear();
  __resetTrackUploaderForTests();
  await __resetTrackBufferForTests();
  roadtrip.tripId = 'sommertour';
  sendFix = null;

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (onPosition: (position: unknown) => void) => {
        sendFix = onPosition as typeof sendFix;
        return 1;
      },
      clearWatch: () => undefined
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  return <TrackingProvider user="Ada">{children}</TrackingProvider>;
}

function fix(lat = 52.5, lng = 13.4) {
  return { coords: { latitude: lat, longitude: lng, speed: 10, heading: 90 } };
}

function storedSessionId(): string {
  return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}').id;
}

describe('TrackingProvider', () => {
  it('schreibt einen Punkt unter einer aus der Aufzeichnung abgeleiteten Kennung', async () => {
    const { result } = renderHook(() => useTracking(), { wrapper });

    act(() => result.current.setIsTracking(true));
    const sessionId = storedSessionId();
    act(() => sendFix!(fix()));

    await waitFor(() => expect(readFakeCollection(TRACK_PATH)).toHaveLength(1));
    const [point] = readFakeCollection(TRACK_PATH);
    expect(point.id).toBe(`${sessionId}_${point.data.timestamp}`);
    expect(point.data).toMatchObject({ author: 'Ada', authorId: 'uid-1', sessionId, lat: 52.5 });
  });

  it('nimmt einen bestätigten Punkt wieder aus dem Puffer', async () => {
    const { result } = renderHook(() => useTracking(), { wrapper });

    act(() => result.current.setIsTracking(true));
    act(() => sendFix!(fix()));

    await waitFor(() => expect(getQueuedCount()).toBe(0));
  });

  it('behält einen Punkt im Puffer, wenn das Schreiben fehlschlägt, und lädt ihn später hoch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const setDoc = vi.spyOn(firestore, 'setDoc').mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useTracking(), { wrapper });

    act(() => result.current.setIsTracking(true));
    act(() => sendFix!(fix()));

    // Der Einzelschreibvorgang ist gescheitert – der Punkt liegt weiter im
    // Puffer und geht über den Nachschub raus.
    await waitFor(async () => expect(await readQueuedPoints(10)).toHaveLength(1));
    expect(setDoc).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(readFakeCollection(TRACK_PATH)).toHaveLength(1));
    await waitFor(() => expect(getQueuedCount()).toBe(0));
  });

  it('setzt eine unterbrochene Aufzeichnung mit derselben Kennung fort', async () => {
    const startedAt = Date.now() - 120_000;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: 'session-vorher',
        startedAt,
        tripId: 'sommertour',
        paused: false,
        lastPointAt: Date.now() - 60_000
      })
    );

    const { result } = renderHook(() => useTracking(), { wrapper });

    await waitFor(() => expect(result.current.isTracking).toBe(true));
    act(() => sendFix!(fix()));

    await waitFor(() => expect(readFakeCollection(TRACK_PATH)).toHaveLength(1));
    expect(readFakeCollection(TRACK_PATH)[0].data.sessionId).toBe('session-vorher');
  });

  it('bietet eine lange liegengebliebene Aufzeichnung zum Benennen an, statt weiterzulaufen', async () => {
    const lastPointAt = Date.now() - 24 * 60 * 60 * 1000;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: 'session-gestern',
        startedAt: lastPointAt - 60_000,
        tripId: 'sommertour',
        paused: false,
        lastPointAt
      })
    );

    const { result } = renderHook(() => useTracking(), { wrapper });

    await waitFor(() => expect(result.current.finishedSession?.id).toBe('session-gestern'));
    expect(result.current.isTracking).toBe(false);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('merkt sich Pause und Stopp der Aufzeichnung', async () => {
    const { result } = renderHook(() => useTracking(), { wrapper });

    act(() => result.current.setIsTracking(true));
    act(() => result.current.setIsPaused(true));
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).paused).toBe(true);

    act(() => result.current.setIsTracking(false));
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(result.current.finishedSession).not.toBeNull();
  });

  it('speichert in der Pause keine Punkte', async () => {
    const { result } = renderHook(() => useTracking(), { wrapper });

    act(() => result.current.setIsTracking(true));
    act(() => result.current.setIsPaused(true));
    act(() => sendFix!(fix()));

    await waitFor(() => expect(result.current.position).not.toBeNull());
    expect(readFakeCollection(TRACK_PATH)).toHaveLength(0);
    expect(getQueuedCount()).toBe(0);
  });
});
