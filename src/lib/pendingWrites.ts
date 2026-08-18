// Firestore-Schreibaufrufe (addDoc/updateDoc/deleteDoc/setDoc) lösen ihr
// zurückgegebenes Promise laut SDK-Verhalten erst auf, wenn der Server den
// Schreibvorgang bestätigt hat – auch dann, wenn das Gerät gerade offline
// ist und der Write nur lokal im persistentLocalCache gequeued wurde. Genau
// dieses "hängt noch" lässt sich also am Promise selbst ablesen, ohne eigene
// Snapshot-Metadaten auszuwerten: trackWrite() zählt einfach, wie viele
// dieser Promises gerade offen sind, und ein einziger globaler Zähler reicht
// für ein simples "wird noch synchronisiert"-Banner.
type Listener = () => void;

let pending = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Wickelt einen Firestore-Schreibaufruf ein, damit er im globalen
 * Pending-Zähler auftaucht, bis er (online oder nach Reconnect) tatsächlich
 * bestätigt ist. Das Original-Promise wird unverändert durchgereicht,
 * inklusive Fehlerfall – Aufrufer behandeln Fehler wie gewohnt selbst.
 */
export function trackWrite<T>(promise: Promise<T>): Promise<T> {
  pending += 1;
  notify();
  const decrement = () => {
    pending = Math.max(0, pending - 1);
    notify();
  };
  promise.then(decrement, decrement);
  return promise;
}

export function getPendingWriteCount(): number {
  return pending;
}

export function subscribePendingWrites(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nur für Tests: setzt den Zähler zwischen Testfällen zurück. */
export function __resetPendingWritesForTests(): void {
  pending = 0;
  listeners.clear();
}
