import { useSyncExternalStore } from 'react';
import { getQueuedCount, subscribeQueuedCount } from '../lib/trackBuffer';

/**
 * Anzahl der Trackpunkte, die noch im Ausgangspuffer liegen.
 *
 * Anders als der Zähler in lib/pendingWrites.ts überlebt diese Zahl den
 * Neustart der App: Sie kommt aus IndexedDB und beantwortet damit die Frage,
 * die nach einer Fahrt ohne Netz wirklich zählt – ist die Strecke schon
 * hochgeladen oder liegt sie noch auf dem Gerät?
 */
export function useQueuedTrackPoints(): number {
  return useSyncExternalStore(subscribeQueuedCount, getQueuedCount, () => 0);
}
