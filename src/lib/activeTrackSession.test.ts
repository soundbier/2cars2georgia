import { afterEach, describe, expect, it } from 'vitest';
import {
  ActiveTrackSession,
  clearActiveSession,
  decideResume,
  readActiveSession,
  RESUME_MAX_GAP_MS,
  writeActiveSession
} from './activeTrackSession';

const NOW = 1_700_000_000_000;

const session: ActiveTrackSession = {
  id: 'session-1',
  startedAt: NOW - 60_000,
  tripId: 'trip-1',
  paused: false,
  lastPointAt: NOW - 30_000
};

afterEach(() => {
  clearActiveSession();
});

describe('gespeicherte Aufzeichnung', () => {
  it('liest zurück, was geschrieben wurde', () => {
    writeActiveSession(session);
    expect(readActiveSession()).toEqual(session);
  });

  it('verwirft einen unbrauchbaren Eintrag, statt daran zu scheitern', () => {
    localStorage.setItem('boat_active_track_session', '{"id":"session-1"}');
    expect(readActiveSession()).toBeNull();
    expect(localStorage.getItem('boat_active_track_session')).toBeNull();
  });

  it('meldet ohne Eintrag null', () => {
    expect(readActiveSession()).toBeNull();
  });
});

describe('decideResume', () => {
  it('setzt eine kurz unterbrochene Aufzeichnung fort', () => {
    expect(decideResume(session, 'trip-1', NOW)).toEqual({ kind: 'resume', session });
  });

  it('bietet eine lange liegengebliebene Aufzeichnung zum Benennen an', () => {
    const decision = decideResume(session, 'trip-1', NOW + RESUME_MAX_GAP_MS + 1);
    expect(decision).toEqual({ kind: 'finish', session });
  });

  it('rührt die Aufzeichnung eines anderen Roadtrips nicht an', () => {
    expect(decideResume(session, 'trip-2', NOW)).toEqual({ kind: 'ignore' });
    expect(decideResume(session, null, NOW)).toEqual({ kind: 'ignore' });
  });

  it('kommt ohne gespeicherte Aufzeichnung zurecht', () => {
    expect(decideResume(null, 'trip-1', NOW)).toEqual({ kind: 'ignore' });
  });
});
