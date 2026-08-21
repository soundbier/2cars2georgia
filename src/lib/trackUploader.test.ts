import { afterEach, describe, expect, it, vi } from 'vitest';
import { enqueueTrackPoint, readQueuedPoints, __resetTrackBufferForTests } from './trackBuffer';
import { flushTrackBuffer, UPLOAD_BATCH_SIZE, __resetTrackUploaderForTests } from './trackUploader';
import { GpsPoint } from '../types';

afterEach(async () => {
  __resetTrackUploaderForTests();
  await __resetTrackBufferForTests();
  vi.restoreAllMocks();
});

function point(timestamp: number): GpsPoint {
  return {
    timestamp,
    author: 'Ada',
    sessionId: 'session-1',
    lat: 52.5,
    lng: 13.4,
    speedKmh: 42,
    headingDeg: 90
  };
}

async function fill(count: number, offset = 0): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await enqueueTrackPoint('trip', point(1000 + offset + i));
  }
}

/** Wartet einen Tick, damit der Durchlauf bis zum offenen Stapel kommt. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

class CodedError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

describe('flushTrackBuffer', () => {
  it('lädt alle Punkte hoch und leert den Puffer', async () => {
    await fill(3);
    const commit = vi.fn().mockResolvedValue(undefined);

    const result = await flushTrackBuffer(commit);

    expect(result).toEqual({ uploaded: 3, dropped: 0, interrupted: false });
    expect(await readQueuedPoints(10)).toHaveLength(0);
  });

  it('lädt in Stapeln und behält die Reihenfolge der Aufnahme', async () => {
    await fill(UPLOAD_BATCH_SIZE + 5);
    const sizes: number[] = [];
    const first: number[] = [];
    const commit = vi.fn(async (entries) => {
      sizes.push(entries.length);
      first.push(entries[0].point.timestamp);
    });

    await flushTrackBuffer(commit);

    expect(sizes).toEqual([UPLOAD_BATCH_SIZE, 5]);
    expect(first[0]).toBeLessThan(first[1]);
  });

  it('behält die Punkte im Puffer, solange der Server nicht erreichbar ist', async () => {
    await fill(2);
    const commit = vi.fn().mockRejectedValue(new CodedError('unavailable'));

    const result = await flushTrackBuffer(commit);

    expect(result.uploaded).toBe(0);
    expect(result.interrupted).toBe(true);
    expect(await readQueuedPoints(10)).toHaveLength(2);
  });

  it('bestätigt erst nach dem Server – ein offener Stapel bleibt im Puffer', async () => {
    await fill(1);
    let confirm!: () => void;
    const commit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirm = resolve;
        })
    );

    const flushing = flushTrackBuffer(commit);
    await tick();
    expect(await readQueuedPoints(10)).toHaveLength(1);

    confirm();
    await flushing;
    expect(await readQueuedPoints(10)).toHaveLength(0);
  });

  it('lässt einen dauerhaft abgelehnten Punkt den Rest der Fahrt nicht blockieren', async () => {
    await fill(4);
    const rejected = 1002;
    const commit = vi.fn(async (entries) => {
      if (entries.some((entry: { point: GpsPoint }) => entry.point.timestamp === rejected)) {
        throw new CodedError('permission-denied');
      }
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Erst nach mehreren Anläufen wird verworfen – ein einzelner Fehlschlag
    // soll keinen Punkt kosten.
    let result = await flushTrackBuffer(commit);
    expect(result.dropped).toBe(0);
    result = await flushTrackBuffer(commit);
    expect(result.dropped).toBe(0);
    result = await flushTrackBuffer(commit);

    expect(result.dropped).toBe(1);
    expect(await readQueuedPoints(10)).toHaveLength(0);
  });

  it('lässt Punkte in Ruhe, um die sich gerade schon jemand kümmert', async () => {
    await fill(2);
    const commit = vi.fn().mockResolvedValue(undefined);

    const result = await flushTrackBuffer(commit, { skip: () => true });

    expect(commit).not.toHaveBeenCalled();
    expect(result.interrupted).toBe(true);
    expect(await readQueuedPoints(10)).toHaveLength(2);
  });

  it('lädt neben einem laufenden Einzelschreibvorgang die übrigen Punkte hoch', async () => {
    await fill(3);
    const inFlight = 'session-1_1001';
    const commit = vi.fn().mockResolvedValue(undefined);

    const result = await flushTrackBuffer(commit, { skip: (entry) => entry.id === inFlight });

    expect(result.uploaded).toBe(2);
    expect((await readQueuedPoints(10)).map((entry) => entry.id)).toEqual([inFlight]);
  });

  it('startet keinen zweiten Durchlauf neben einem laufenden', async () => {
    await fill(1);
    let confirm!: () => void;
    const commit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirm = resolve;
        })
    );

    const first = flushTrackBuffer(commit);
    const second = flushTrackBuffer(commit);
    expect(second).toBe(first);

    await tick();
    confirm();
    await first;
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('nimmt Punkte mit, die während des Hochladens dazukommen', async () => {
    await fill(1);
    const commit = vi.fn().mockResolvedValue(undefined);

    const flushing = flushTrackBuffer(commit);
    await enqueueTrackPoint('trip', point(5000));
    const result = await flushing;

    expect(result.uploaded).toBe(2);
    expect(await readQueuedPoints(10)).toHaveLength(0);
  });
});
