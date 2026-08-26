import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  OrderByDirection,
  QueryConstraint,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

function toItems<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as T);
}

function buildQuery(
  path: string,
  orderField: string,
  direction: OrderByDirection,
  since: number | null
) {
  const constraints: QueryConstraint[] = [];
  // Vor dem orderBy: Firestore verlangt, dass das eingeschränkte Feld auch
  // das erste Sortierfeld ist – hier ohnehin dasselbe.
  if (since !== null) constraints.push(where(orderField, '>=', since));
  constraints.push(orderBy(orderField, direction));
  return query(collection(db, path), ...constraints);
}

/**
 * Abonniert eine Firestore-Collection und liefert die Dokumente inklusive id.
 *
 * Ersetzt die zuvor in jeder Seite wiederholte onSnapshot-Schleife. Die Daten
 * kommen dank persistentLocalCache auch offline aus dem lokalen Cache.
 *
 * `path` darf null sein (z.B. solange noch kein Roadtrip angemeldet ist) –
 * dann wird nichts abonniert und eine leere Liste geliefert.
 *
 * `since` grenzt das Abo auf Dokumente ab diesem Wert im Sortierfeld ein.
 * Gedacht für die Spur: Nach ein paar Wochen Fahrt sind das zehntausende
 * Punkte, und eine Seite, die davon nur den heutigen Tag anzeigt, soll auch
 * nur den heutigen Tag laden – statt bei jedem Öffnen die ganze Reise durch
 * Netz, Speicher und Renderpfad zu ziehen. null (Vorgabe) lädt alles.
 */
export function useCollection<T>(
  path: string | null,
  orderField = 'timestamp',
  direction: OrderByDirection = 'asc',
  since: number | null = null
): T[] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!path) {
      setItems([]);
      return;
    }
    return onSnapshot(
      buildQuery(path, orderField, direction, since),
      (snapshot) => setItems(toItems<T>(snapshot)),
      (err) => console.error(`Firestore-Fehler (${path}):`, err)
    );
  }, [path, orderField, direction, since]);

  return items;
}

/**
 * Dasselbe, aber einmalig beim Einhängen statt als laufendes Abo.
 *
 * Für Seiten, die einen Stand exportieren oder auflisten, statt ihn
 * mitzuverfolgen: Ein Dauerabo auf die ganze Spur hält dort nur Speicher
 * fest und zählt weiter Leseoperationen, ohne dass irgendetwas davon
 * sichtbar würde. Wer den neuesten Stand will, öffnet die Seite erneut.
 *
 * `loading` unterscheidet „noch nicht geladen" von „nichts vorhanden" –
 * ohne das zeigte ein Export während des Ladens eine leere Reise an.
 */
export function useCollectionOnce<T>(
  path: string | null,
  orderField = 'timestamp',
  direction: OrderByDirection = 'asc'
): { items: T[]; loading: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(path !== null);

  useEffect(() => {
    if (!path) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDocs(buildQuery(path, orderField, direction, null))
      .then((snapshot) => {
        if (cancelled) return;
        setItems(toItems<T>(snapshot));
        setLoading(false);
      })
      .catch((err) => {
        console.error(`Firestore-Fehler (${path}):`, err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, orderField, direction]);

  return { items, loading };
}
