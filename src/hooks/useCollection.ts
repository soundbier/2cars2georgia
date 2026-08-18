import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, OrderByDirection } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Abonniert eine Firestore-Collection und liefert die Dokumente inklusive id.
 *
 * Ersetzt die zuvor in jeder Seite wiederholte onSnapshot-Schleife. Die Daten
 * kommen dank persistentLocalCache auch offline aus dem lokalen Cache.
 *
 * `path` darf null sein (z.B. solange noch kein Roadtrip angemeldet ist) –
 * dann wird nichts abonniert und eine leere Liste geliefert.
 */
export function useCollection<T>(
  path: string | null,
  orderField = 'timestamp',
  direction: OrderByDirection = 'asc'
): T[] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!path) {
      setItems([]);
      return;
    }
    const q = query(collection(db, path), orderBy(orderField, direction));
    return onSnapshot(
      q,
      (snapshot) => setItems(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as T)),
      (err) => console.error(`Firestore-Fehler (${path}):`, err)
    );
  }, [path, orderField, direction]);

  return items;
}
