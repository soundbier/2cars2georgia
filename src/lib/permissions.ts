import { TranslationKey } from '../i18n/translate';
import { CrewRole } from '../types';

export const CREW_ROLES: CrewRole[] = ['owner', 'member', 'readonly'];

/** Übersetzungsschlüssel der Rollen-Anzeigenamen, für Select-Optionen und Badges. */
export const ROLE_LABEL_KEY: Record<CrewRole, TranslationKey> = {
  owner: 'crew.role.owner',
  member: 'crew.role.member',
  readonly: 'crew.role.readonly'
};

/**
 * Nur Owner dürfen die Crew verwalten: einladen entfällt (Beitritt ist
 * selbstständig, siehe lib/membership.ts), aber entfernen und Rollen
 * vergeben bleiben Owner-Sache. Durchgesetzt wird das serverseitig in
 * firestore.rules – diese Funktion blendet nur die passende Oberfläche ein.
 */
export function canManageCrew(role: CrewRole): boolean {
  return role === 'owner';
}

/** Read-only darf alles ansehen, aber nichts anlegen, ändern oder löschen. */
export function canEdit(role: CrewRole): boolean {
  return role !== 'readonly';
}

/** Nur der Owner darf den Roadtrip endgültig löschen. */
export function canDeleteRoadtrip(role: CrewRole): boolean {
  return role === 'owner';
}

/** Anzahl der Crewmitglieder mit Owner-Rolle – für die "letzter Owner"-Warnung in der Oberfläche. */
export function countOwners(members: { role: CrewRole }[]): number {
  return members.filter((m) => m.role === 'owner').length;
}
