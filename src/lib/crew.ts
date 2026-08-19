import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { tripPath } from '../hooks/useRoadtrip';
import { CrewRole } from '../types';

/**
 * Die Crew-Liste eines Roadtrips (settings/general).
 *
 * Ein neu angelegter Roadtrip startet ohne Mitglieder – wer beitritt, trägt
 * sich beim ersten Start selbst ein (CrewGate in App.tsx). Vorher kamen vier
 * feste Vornamen aus dem Code mit, die in jedem fremden Roadtrip standen.
 */

/** Passt zur Längenprüfung von `author` in firestore.rules. */
export const MAX_CREW_NAME_LENGTH = 60;

/** Führende/abschließende Leerzeichen weg, mehrfache in der Mitte zusammengezogen. */
export function normalizeCrewName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_CREW_NAME_LENGTH);
}

/**
 * Ist der Name schon an Bord? Bewusst ohne Rücksicht auf Groß-/Kleinschreibung:
 * "Leon" und "leon" nebeneinander wären für die Crew nicht unterscheidbar, für
 * jede Auswertung nach Autor aber zwei verschiedene Personen.
 */
export function isCrewNameTaken(users: string[], name: string): boolean {
  const normalized = normalizeCrewName(name).toLowerCase();
  return users.some((user) => user.toLowerCase() === normalized);
}

/**
 * Trägt ein Crewmitglied in settings/general ein.
 *
 * `setDoc` mit `merge` statt `updateDoc`, weil das Dokument bei der ersten
 * Person noch gar nicht existiert – `updateDoc` würde daran scheitern.
 * `arrayUnion` hält zwei gleichzeitig beitretende Geräte auseinander, ohne
 * dass eines das andere überschreibt.
 */
export function addCrewMember(tripId: string, name: string, role: CrewRole): Promise<void> {
  return setDoc(
    doc(db, tripPath(tripId, 'settings', 'general')),
    { users: arrayUnion(name), roles: { [name]: role } },
    { merge: true }
  );
}

/**
 * Rolle, mit der jemand beitritt: Die erste Person an Bord verwaltet die Crew,
 * alle weiteren fahren mit. Ohne diese Regel stünde ein frischer Roadtrip ohne
 * Owner da – niemand könnte dann Rollen vergeben, auch nicht sich selbst.
 */
export function joiningRole(users: string[]): CrewRole {
  return users.length === 0 ? 'owner' : 'member';
}
