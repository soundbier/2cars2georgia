import { useCrew } from './useSettings';
import { canEdit, canManageCrew, getEffectiveRole } from '../lib/permissions';
import { CrewRole } from '../types';

export interface Permissions {
  role: CrewRole;
  /** Owner: darf die Crew verwalten (einladen, entfernen, Rollen vergeben). */
  isOwner: boolean;
  canManageCrew: boolean;
  /** false für Read-only: nichts anlegen, ändern oder löschen, nur ansehen. */
  canEdit: boolean;
}

/** Rolle und daraus abgeleitete Rechte des angemeldeten Crewmitglieds. */
export function usePermissions(currentUser: string): Permissions {
  const { users, roles } = useCrew();
  const role = getEffectiveRole(users, roles, currentUser);
  return {
    role,
    isOwner: role === 'owner',
    canManageCrew: canManageCrew(role),
    canEdit: canEdit(role)
  };
}
