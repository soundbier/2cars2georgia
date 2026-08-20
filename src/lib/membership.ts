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
 * Kandidaten-IDs für eine Beitritts-Eingabe, in Reihenfolge der Prüfung.
 *
 * Eingegeben wird in aller Regel der sichtbare Roadtrip-Name ("Sommertour
 * 2026"); die Dokument-ID ist aber dessen Slug ("sommertour-2026", siehe
 * createRoadtrip). Beides muss zum Ziel führen: der Name, weil ihn die Crew
 * kennt, und die ID, weil der Owner sie als Beitritts-Code weitergibt
 * (siehe Einstellungen → Crew). Eine Suche über die ganze Collection wäre
 * der Alternativweg, scheidet aber aus: `list` auf roadtrips/ ist in
 * firestore.rules bewusst auf Mitglieder beschränkt, damit niemand fremde
 * Roadtrips auflisten kann.
 */
function joinCandidateIds(input: string): string[] {
  const candidates: string[] = [];
  // Firestore-Dokument-IDs dürfen keinen Schrägstrich enthalten – eine
  // solche Eingabe würde doc() werfen statt einfach nicht zu treffen.
  if (input && !input.includes('/')) candidates.push(input);
  const slug = slugifyTripName(input);
  if (slug && !candidates.includes(slug)) candidates.push(slug);
  return candidates;
}

/**
 * Tritt einem bestehenden Roadtrip als normales Mitglied bei. Akzeptiert
 * sowohl den sichtbaren Roadtrip-Namen als auch die Roadtrip-ID.
 *
 * Ist die aufrufende Person bereits Mitglied, wird nichts geschrieben und
 * der Roadtrip einfach zurückgegeben: Ein zweiter Beitritt darf weder einen
 * doppelten Datensatz erzeugen noch eine bestehende Owner-Rolle auf
 * `member` zurückstufen.
 */
export async function joinRoadtrip(
  uid: string,
  displayName: string,
  nameOrTripId: string
): Promise<CreateRoadtripResult> {
  const trimmed = nameOrTripId.trim();
  if (!trimmed) throw new MembershipError('missingName');

  let tripId: string | null = null;
  let tripName = trimmed;
  for (const candidate of joinCandidateIds(trimmed)) {
    const snap = await getDoc(doc(db, 'roadtrips', candidate));
    if (!snap.exists()) continue;
    tripId = candidate;
    tripName = (snap.data().name as string | undefined) ?? candidate;
    break;
  }
  if (!tripId) throw new MembershipError('tripNotFound');

  const memberRef = doc(db, 'roadtrips', tripId, 'members', uid);
  const existing = await getDoc(memberRef);
  if (existing.exists()) return { tripId, tripName };

  try {
    await setDoc(memberRef, {
      displayName: normalizeDisplayName(displayName),
      role: 'member' satisfies CrewRole,
      joinedAt: serverTimestamp()
    });
  } catch {
    throw new MembershipError('unknown');
  }

  return { tripId, tripName };
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
  'events',
  'expenses',
  'dishes',
  'mealPlanEntries',
  'inventory',
  'shoppingListExtras',
  'shoppingListChecks',
  'plannedRoutes',
  'errors'
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
