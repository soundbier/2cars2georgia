import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { CrewRole } from '../types';
import { normalizeDisplayName } from './username';

/**
 * Roadtrip-Mitgliedschaften: `roadtrips/{tripId}/members/{uid}`.
 *
 * Ersetzt den früheren technischen Roadtrip-User (lib/roadtrip.ts) und die
 * users[]/roles-Liste in settings/general (lib/crew.ts). Jede Mitgliedschaft
 * gehört zu einer echten Firebase-UID; die Rolle steht direkt am
 * Mitgliedschafts-Dokument und wird von firestore.rules durchgesetzt, nicht
 * nur von der Oberfläche (siehe lib/permissions.ts).
 */

/** Wandelt einen Roadtrip-Namen in eine URL-/Freigabe-taugliche ID um. */
export function slugifyTripName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type MembershipErrorCode =
  | 'missingName'
  | 'invalidTripDates'
  | 'tripNotFound'
  | 'unknown';

/** Stand eines gestellten Beitrittsantrags, wie ihn der Beitritts-Screen zeigt. */
export interface JoinRequestResult {
  tripId: string;
  /** Name des Roadtrips – lesbar, sobald der Antrag steht (siehe firestore.rules). */
  tripName: string;
  /** true, wenn die Person bereits Mitglied ist und gar nicht warten muss. */
  alreadyMember: boolean;
}

/** Ein offener Antrag, wie ihn der Owner in der Crew-Verwaltung sieht. */
export interface JoinRequest {
  uid: string;
  displayName: string;
  /** Zeitpunkt des Antrags in Millisekunden, oder null solange der Server ihn setzt. */
  requestedAt: number | null;
}

export class MembershipError extends Error {
  constructor(readonly code: MembershipErrorCode) {
    super(`membership failed: ${code}`);
    this.name = 'MembershipError';
  }
}

/** Kurzer Zufalls-Suffix, um Slug-Kollisionen zwischen fremden Roadtrips aufzulösen. */
function randomSuffix(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36)).join('').slice(0, 4);
}

async function findFreeTripId(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getDoc(doc(db, 'roadtrips', candidate));
    if (!snap.exists()) return candidate;
    candidate = `${baseSlug}-${randomSuffix()}`;
  }
  return `${baseSlug}-${randomSuffix()}-${randomSuffix()}`;
}

export interface CreateRoadtripResult {
  tripId: string;
  tripName: string;
}

/**
 * Legt einen neuen Roadtrip an und macht die aufrufende Person zu dessen
 * Owner. Zwei sequenzielle Schreibvorgänge statt einem Batch: Die
 * Owner-Regel für das Mitgliedschafts-Dokument prüft per `get()`, dass
 * `roadtrips/{tripId}.ownerUid` der eigenen UID entspricht – dafür muss der
 * Roadtrip-Datensatz zum Zeitpunkt der Prüfung bereits committed sein.
 */
export async function createRoadtrip(
  uid: string,
  displayName: string,
  name: string,
  tripStartDate: string,
  tripEndDate: string
): Promise<CreateRoadtripResult> {
  const trimmedName = name.trim();
  const baseSlug = slugifyTripName(trimmedName);
  if (!trimmedName || !baseSlug) throw new MembershipError('missingName');
  if (!tripStartDate || !tripEndDate || tripEndDate < tripStartDate) {
    throw new MembershipError('invalidTripDates');
  }

  const tripId = await findFreeTripId(baseSlug);
  const tripRef = doc(db, 'roadtrips', tripId);

  try {
    await setDoc(tripRef, {
      name: trimmedName,
      ownerUid: uid,
      createdAt: serverTimestamp()
    });
  } catch {
    throw new MembershipError('unknown');
  }

  try {
    await setDoc(doc(db, 'roadtrips', tripId, 'members', uid), {
      displayName: normalizeDisplayName(displayName),
      role: 'owner' satisfies CrewRole,
      joinedAt: serverTimestamp()
    });
    await setDoc(
      doc(db, 'roadtrips', tripId, 'settings', 'general'),
      { startDate: tripStartDate, endDate: tripEndDate },
      { merge: true }
    );
  } catch (err) {
    // Best effort: einen halb angelegten Roadtrip ohne Owner-Mitgliedschaft
    // nicht als Datenleiche stehen lassen. Die Owner-Cleanup-Regel in
    // firestore.rules erlaubt genau das: löschen, solange man selbst noch
    // kein Mitglied dieses Roadtrips ist.
    await deleteDoc(tripRef).catch(() => undefined);
    throw err instanceof MembershipError ? err : new MembershipError('unknown');
  }

  return { tripId, tripName: trimmedName };
}

/**
 * Die Roadtrip-ID zu einer Beitritts-Eingabe.
 *
 * Eingegeben wird die ID, die der Owner weitergibt ("sommertour-2026"). Wer
 * stattdessen den sichtbaren Namen tippt ("Sommertour 2026"), landet über
 * dieselbe Slug-Bildung wie beim Anlegen am selben Ziel. Nachschlagen lässt
 * sich das nicht mehr: `get` auf einen fremden Roadtrip ist gesperrt, solange
 * kein Antrag vorliegt (siehe firestore.rules) – genau das war der Weg, auf
 * dem sich fremde Roadtrips durchprobieren ließen.
 */
export function joinTripId(input: string): string {
  const trimmed = input.trim();
  // Sieht schon aus wie eine ID? Dann unverändert lassen – slugifyTripName
  // würde sie zwar nicht kaputtmachen, aber die Absicht ist klarer so.
  if (/^[a-z0-9][a-z0-9-]*$/.test(trimmed)) return trimmed;
  return slugifyTripName(trimmed);
}

/**
 * Stellt einen Beitrittsantrag für einen bestehenden Roadtrip.
 *
 * Beitreten ist kein Selbstbedienungsvorgang mehr: Wer die Roadtrip-ID kennt,
 * darf sich bewerben, aufgenommen wird er erst vom Owner (siehe
 * `approveJoinRequest` und firestore.rules). Vorher genügte die Kenntnis der
 * ID – und die ist der Slug des Reisenamens, also ratbar.
 *
 * Die Reihenfolge ist der Preis dafür: Erst wird der Antrag geschrieben, dann
 * der Roadtrip gelesen. Andersherum ginge es nicht, denn das Leserecht
 * entsteht überhaupt erst durch den Antrag. Trifft die Eingabe ins Leere,
 * wird der Antrag wieder eingesammelt, statt als Leiche liegen zu bleiben.
 */
export async function requestJoin(
  uid: string,
  displayName: string,
  nameOrTripId: string
): Promise<JoinRequestResult> {
  const tripId = joinTripId(nameOrTripId);
  if (!tripId) throw new MembershipError('missingName');

  // Wer schon Mitglied ist, braucht keinen Antrag: Das eigene
  // Mitgliedschafts-Dokument darf man immer lesen.
  const memberSnap = await getDoc(doc(db, 'roadtrips', tripId, 'members', uid));
  if (memberSnap.exists()) {
    const tripSnap = await getDoc(doc(db, 'roadtrips', tripId));
    return {
      tripId,
      tripName: (tripSnap.data()?.name as string | undefined) ?? tripId,
      alreadyMember: true
    };
  }

  const requestRef = doc(db, 'roadtrips', tripId, 'joinRequests', uid);
  const existing = await getDoc(requestRef);
  if (!existing.exists()) {
    try {
      await setDoc(requestRef, {
        displayName: normalizeDisplayName(displayName),
        requestedAt: serverTimestamp()
      });
    } catch {
      throw new MembershipError('unknown');
    }
  }

  const tripSnap = await getDoc(doc(db, 'roadtrips', tripId));
  if (!tripSnap.exists()) {
    await deleteDoc(requestRef).catch(() => undefined);
    throw new MembershipError('tripNotFound');
  }

  return {
    tripId,
    tripName: (tripSnap.data().name as string | undefined) ?? tripId,
    alreadyMember: false
  };
}

/** Zieht den eigenen Antrag zurück. */
export function withdrawJoinRequest(tripId: string, uid: string): Promise<void> {
  return deleteDoc(doc(db, 'roadtrips', tripId, 'joinRequests', uid));
}

/**
 * Nimmt eine Antragstellerin als Mitglied auf – nur der Owner darf das.
 *
 * Erst die Mitgliedschaft, dann der Antrag: Die Regel für `members` prüft,
 * dass der Antrag im Moment der Aufnahme noch existiert und denselben
 * Anzeigenamen trägt. Andersherum bliebe im Fehlerfall jemand ohne beides
 * zurück.
 */
export async function approveJoinRequest(
  tripId: string,
  uid: string,
  displayName: string
): Promise<void> {
  await setDoc(doc(db, 'roadtrips', tripId, 'members', uid), {
    displayName,
    role: 'member' satisfies CrewRole,
    joinedAt: serverTimestamp()
  });
  await deleteDoc(doc(db, 'roadtrips', tripId, 'joinRequests', uid));
}

/** Lehnt einen Antrag ab: Der Antrag verschwindet, eine Mitgliedschaft entsteht nicht. */
export function rejectJoinRequest(tripId: string, uid: string): Promise<void> {
  return deleteDoc(doc(db, 'roadtrips', tripId, 'joinRequests', uid));
}

/** Ändert die Rolle eines Mitglieds – nur der Owner darf das (siehe firestore.rules). */
export function updateMemberRole(tripId: string, uid: string, role: CrewRole): Promise<void> {
  return updateDoc(doc(db, 'roadtrips', tripId, 'members', uid), { role });
}

/** Entfernt ein Mitglied aus der Crew (Owner-Recht) oder verlässt den Roadtrip selbst. */
export function removeMember(tripId: string, uid: string): Promise<void> {
  return deleteDoc(doc(db, 'roadtrips', tripId, 'members', uid));
}

const CASCADE_COLLECTIONS = [
  'track',
  'trackSessions',
  'events',
  'expenses',
  'dishes',
  'mealPlanEntries',
  'inventory',
  'shoppingListExtras',
  'shoppingListChecks',
  'plannedRoutes',
  'errors',
  'joinRequests'
];

const BATCH_CHUNK_SIZE = 400;

async function deleteAllDocs(collectionPath: string): Promise<void> {
  const snap = await getDocs(query(collection(db, collectionPath)));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_CHUNK_SIZE)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

/**
 * Löscht einen Roadtrip endgültig, inklusive aller Untercollections – nur
 * der Owner darf das (siehe firestore.rules). Da dieses Projekt keine Cloud
 * Functions hat, läuft das Aufräumen client-seitig in Batches; die eigene
 * Owner-Mitgliedschaft wird bewusst zuletzt gelöscht, damit die Owner-Regel
 * für alle vorherigen Schritte noch greift.
 */
export async function deleteRoadtripCascade(tripId: string, ownerUid: string): Promise<void> {
  for (const collectionName of CASCADE_COLLECTIONS) {
    await deleteAllDocs(`roadtrips/${tripId}/${collectionName}`);
  }
  await deleteDoc(doc(db, 'roadtrips', tripId, 'settings', 'general')).catch(() => undefined);
  await deleteDoc(doc(db, 'roadtrips', tripId, 'settings', 'quicklogs')).catch(() => undefined);

  const membersSnap = await getDocs(collection(db, 'roadtrips', tripId, 'members'));
  for (const memberDoc of membersSnap.docs) {
    if (memberDoc.id === ownerUid) continue;
    await deleteDoc(memberDoc.ref);
  }

  await deleteDoc(doc(db, 'roadtrips', tripId));
  await deleteDoc(doc(db, 'roadtrips', tripId, 'members', ownerUid));
}
