import { TranslationKey } from '../i18n/translate';
import { CrewRole, CrewRoles } from '../types';

export const CREW_ROLES: CrewRole[] = ['owner', 'member', 'readonly'];

/** Übersetzungsschlüssel der Rollen-Anzeigenamen, für Select-Optionen und Badges. */
export const ROLE_LABEL_KEY: Record<CrewRole, TranslationKey> = {
  owner: 'crew.role.owner',
  member: 'crew.role.member',
  readonly: 'crew.role.readonly'
};

/**
 * Effektive Rolle eines Crewmitglieds.
 *
 * Es gibt bewusst keine Migration, die bestehenden Roadtrips beim Update ein
 * `roles`-Feld nachträgt: Solange niemand explizit eine Rolle vergeben hat,
 * gilt das erste Crewmitglied der Liste (typischerweise die Person, die den
 * Roadtrip angelegt hat) als impliziter Owner, alle anderen als Mitfahrer.
 * Sobald irgendwo im gespeicherten `roles`-Feld ein Owner steht, greift diese
 * Annahme nicht mehr – dann zählt ausschließlich, was gespeichert ist.
 */
export function getEffectiveRole(users: string[], roles: CrewRoles | undefined, name: string): CrewRole {
  const stored = roles?.[name];
  if (stored) return stored;

  const hasExplicitOwner = users.some((u) => roles?.[u] === 'owner');
  if (!hasExplicitOwner && users[0] === name) return 'owner';
  return 'member';
}

/** Nur Owner dürfen einladen, entfernen und Rollen vergeben. */
export function canManageCrew(role: CrewRole): boolean {
  return role === 'owner';
}

/** Read-only darf alles ansehen, aber nichts anlegen, ändern oder löschen. */
export function canEdit(role: CrewRole): boolean {
  return role !== 'readonly';
}

/** Anzahl der Crewmitglieder mit (impliziter oder expliziter) Owner-Rolle. */
export function countOwners(users: string[], roles: CrewRoles | undefined): number {
  return users.filter((name) => getEffectiveRole(users, roles, name) === 'owner').length;
}
