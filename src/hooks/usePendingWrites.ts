import { useSyncExternalStore } from 'react';
import { getPendingWriteCount, subscribePendingWrites } from '../lib/pendingWrites';

/** Anzahl der Firestore-Schreibvorgänge, die noch nicht vom Server bestätigt sind. */
export function usePendingWrites(): number {
  return useSyncExternalStore(subscribePendingWrites, getPendingWriteCount, () => 0);
}
