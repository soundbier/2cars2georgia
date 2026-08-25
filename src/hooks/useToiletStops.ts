import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './useCollection';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { usePermissions } from './usePermissions';
import { activeOnly } from '../lib/trash';
import { writeErrorKey, writeOptimistically } from '../lib/writeOutcome';
import {
  createToiletStopId,
  isBristolType,
  TOILET_DETAILS,
  TOILET_STOPS
} from '../lib/toiletStops';
import { BristolType, ToiletDetail, ToiletPlaceType, ToiletStop } from '../types';
import { useT } from '../i18n';
import { useToast } from '../components/ui';

/**
 * Die Toilettenstopps des Roadtrips – die geteilten Marker und die eigenen
 * Beschreibungen dazu.
 *
 * Beides kommt getrennt herein, weil es getrennt gespeichert ist (siehe
 * lib/toiletStops.ts): Die Marker liest die ganze Crew, die Beschreibungen
 * liest nur, wer sie geschrieben hat. Die Abfrage danach ist deshalb kein
 * Schmuck, sondern Bedingung – firestore.rules lehnt eine Abfrage über alle
 * Beschreibungen ab, weil sie fremde Dokumente treffen würde.
 */

export interface ToiletStopInput {
  lat: number;
  lng: number;
  placeType: ToiletPlaceType;
  bristolType: BristolType;
}

export interface ToiletStopChanges {
  lat?: number;
  lng?: number;
  placeType?: ToiletPlaceType;
  bristolType?: BristolType;
}

export interface ToiletStopsState {
  /** Alle Stopps des Roadtrips ohne Papierkorb, neueste zuerst. */
  stops: ToiletStop[];
  /** Nur die eigenen – nur sie lassen sich beschreiben und bearbeiten. */
  myStops: ToiletStop[];
  /** Beschreibung je Stopp-Id, ausschließlich die eigenen. */
  detailById: Map<string, ToiletDetail>;
  myDetails: ToiletDetail[];
  canEdit: boolean;
  /** true, wenn der Stopp von diesem Konto stammt. */
  isMine: (stop: ToiletStop) => boolean;
  /** Legt Marker und Beschreibung an; liefert die Id oder null. */
  add: (input: ToiletStopInput) => string | null;
  update: (stop: ToiletStop, changes: ToiletStopChanges) => void;
}

/**
 * Die eigenen Beschreibungen, nach Stopp-Id.
 *
 * Bewusst nicht über useCollection: Die Abfrage braucht den Filter auf die
 * eigene UID, sonst weist der Server sie ab. Sortiert wird nichts – die
 * Reihenfolge gibt der Marker vor, zu dem die Beschreibung gehört.
 */
function useMyToiletDetails(tripId: string | null, uid: string | null): Map<string, ToiletDetail> {
  const [details, setDetails] = useState<Map<string, ToiletDetail>>(new Map());

  useEffect(() => {
    if (!tripId || !uid) {
      setDetails(new Map());
      return;
    }
    const q = query(collection(db, tripPath(tripId, TOILET_DETAILS)), where('authorId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const next = new Map<string, ToiletDetail>();
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as ToiletDetail;
          // Der Filter oben ist die eigentliche Zusicherung; hier steht er
          // noch einmal, damit auch ein unerwartet mitgelieferter Datensatz
          // nicht in der eigenen Auswertung landet.
          if (data.authorId !== uid || !isBristolType(data.bristolType)) continue;
          next.set(docSnap.id, { ...data, id: docSnap.id });
        }
        setDetails(next);
      },
      (err) => console.error('Firestore-Fehler (toiletDetails):', err)
    );
  }, [tripId, uid]);

  return details;
}

export function useToiletStops(): ToiletStopsState {
  const { tripId, displayName, authUser } = useRoadtrip();
  const { canEdit } = usePermissions();
  const { notify } = useToast();
  const t = useT();
  const uid = authUser?.uid ?? null;

  const allStops = useCollection<ToiletStop>(
    tripId ? tripPath(tripId, TOILET_STOPS) : null,
    'timestamp',
    'desc'
  );
  const detailById = useMyToiletDetails(tripId, uid);

  // Was im Papierkorb liegt, gehört weder auf die Karte noch in den Zähler –
  // sichtbar bleibt es allein unter Einstellungen → Papierkorb.
  const stops = useMemo(() => activeOnly(allStops), [allStops]);
  const myStops = useMemo(() => stops.filter((stop) => stop.authorId === uid), [stops, uid]);

  // Beschreibungen ohne zugehörigen sichtbaren Stopp zählen nicht mit: Nach
  // dem Löschen eines Markers bliebe seine Beschreibung sonst für immer in
  // der eigenen Verteilung stehen.
  const myDetails = useMemo(
    () => myStops.map((stop) => detailById.get(stop.id!)).filter((detail): detail is ToiletDetail => !!detail),
    [myStops, detailById]
  );

  const fail = useCallback(
    (err: unknown) => notify(t(writeErrorKey(err, 'common.saveError')), 'danger'),
    [notify, t]
  );

  const add = useCallback(
    ({ lat, lng, placeType, bristolType }: ToiletStopInput) => {
      if (!tripId || !uid || !canEdit) return null;
      const id = createToiletStopId();
      const stop: ToiletStop = {
        timestamp: Date.now(),
        author: displayName ?? '',
        authorId: uid,
        lat,
        lng,
        placeType
      };
      // Zwei Schreibvorgänge, keine Transaktion: Sie liegen in verschiedenen
      // Collections und entstehen häufig ohne Netz. Firestore wendet beide
      // sofort lokal an und schickt sie später einzeln nach; bliebe die
      // Beschreibung dabei auf der Strecke, steht der Marker eben ohne sie da
      // (siehe lib/writeOutcome.ts).
      writeOptimistically(setDoc(doc(db, tripPath(tripId, TOILET_STOPS, id)), stop), fail);
      writeOptimistically(
        setDoc(doc(db, tripPath(tripId, TOILET_DETAILS, id)), { authorId: uid, bristolType }),
        fail
      );
      return id;
    },
    [tripId, uid, canEdit, displayName, fail]
  );

  const update = useCallback(
    (stop: ToiletStop, changes: ToiletStopChanges) => {
      if (!tripId || !stop.id || !canEdit) return;
      const { bristolType, ...marker } = changes;
      if (Object.keys(marker).length > 0) {
        writeOptimistically(updateDoc(doc(db, tripPath(tripId, TOILET_STOPS, stop.id)), marker), fail);
      }
      // Die Beschreibung gehört der Person, nicht dem Roadtrip: Fremde Stopps
      // lassen sich nicht beschreiben, auch nicht versehentlich.
      if (bristolType !== undefined && uid && stop.authorId === uid) {
        writeOptimistically(
          setDoc(doc(db, tripPath(tripId, TOILET_DETAILS, stop.id)), { authorId: uid, bristolType }),
          fail
        );
      }
    },
    [tripId, canEdit, uid, fail]
  );

  const isMine = useCallback((stop: ToiletStop) => !!uid && stop.authorId === uid, [uid]);

  return { stops, myStops, detailById, myDetails, canEdit, isMine, add, update };
}
