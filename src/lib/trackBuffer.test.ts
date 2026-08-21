import { afterEach, describe, expect, it } from 'vitest';
import {
  enqueueTrackPoint,
  getQueuedCount,
  readQueuedPoints,
  removeQueuedPoints,
  subscribeQueuedCount,
  trackPointId,
  __resetTrackBufferForTests
} from './trackBuffer';
import { GpsPoint } from '../types';

// Ohne IndexedDB (jsdom) läuft der Puffer auf seiner Rückfallebene im
// Arbeitsspeicher – dieselbe Schnittstelle, dieselben Zusagen bis auf die
// Haltbarkeit über den Neustart hinaus.

afterEach(async () => {
  await __resetTrackBufferForTests();
});

function point(timestamp: number, sessionId = 'session-1'): GpsPoint {
  return {
    timestamp,
    author: 'Ada',
    sessionId,
    lat: 52.5,
    lng: 13.4,
    speedKmh: 42,
    headingDeg: 90
  };
}

describe('trackPointId', () => {
  it('leitet die Kennung aus Aufzeichnung und Zeitstempel ab', () => {
    expect(trackPointId(point(1700000000000))).toBe('session-1_1700000000000');
  });

  it('vergibt für Punkte ohne Aufzeichnung eine eigene Kennung', () => {
    const { sessionId, ...withoutSession } = point(1700000000000);
    void sessionId;
    const first = trackPointId(withoutSession);
    const second = trackPointId(withoutSession);
    expect(first).not.toBe(second);
  });
});

describe('Track-Puffer', () => {
  it('gibt gepufferte Punkte in der Reihenfolge der Aufnahme zurück', async () => {
    await enqueueTrackPoint('trip', point(300));
    await enqueueTrackPoint('trip', point(100));
    await enqueueTrackPoint('trip', point(200));

    const queued = await readQueuedPoints(10);
    expect(queued.map((entry) => entry.point.timestamp)).toEqual([100, 200, 300]);
    expect(queued[0].tripId).toBe('trip');
  });

  it('speichert denselben Punkt nicht zweimal', async () => {
    await enqueueTrackPoint('trip', point(100));
    await enqueueTrackPoint('trip', point(100));

    expect(await readQueuedPoints(10)).toHaveLength(1);
    expect(getQueuedCount()).toBe(1);
  });

  it('meldet jede Änderung am Füllstand', async () => {
    let notified = 0;
    const unsubscribe = subscribeQueuedCount(() => {
      notified += 1;
    });

    await enqueueTrackPoint('trip', point(100));
    expect(getQueuedCount()).toBe(1);
    await removeQueuedPoints([trackPointId(point(100))]);
    expect(getQueuedCount()).toBe(0);
    expect(notified).toBe(2);
    unsubscribe();
  });

  it('entfernt nur die genannten Punkte', async () => {
    await enqueueTrackPoint('trip', point(100));
    await enqueueTrackPoint('trip', point(200));

    await removeQueuedPoints([trackPointId(point(100))]);

    const queued = await readQueuedPoints(10);
    expect(queued.map((entry) => entry.point.timestamp)).toEqual([200]);
  });

  it('gibt nur so viele Punkte heraus, wie angefragt wurden', async () => {
    await enqueueTrackPoint('trip', point(100));
    await enqueueTrackPoint('trip', point(200));
    await enqueueTrackPoint('trip', point(300));

    expect(await readQueuedPoints(2)).toHaveLength(2);
    expect(await readQueuedPoints(0)).toHaveLength(0);
  });
});
