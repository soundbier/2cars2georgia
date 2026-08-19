import { useRoadtrip } from './useRoadtrip';
import { canDeleteRoadtrip, canEdit, canManageCrew } from '../lib/permissions';
import { CrewRole } from '../types';

export interface Permissions {
  role: CrewRole;
  /** Owner: darf die Crew verwalten (Rollen vergeben, entfernen) und den Roadtrip löschen. */
  isOwner: boolean;
  canManageCrew: boolean;
  canDeleteRoadtrip: boolean;
  /** false für Read-only: nichts anlegen, ändern oder löschen, nur ansehen. */
  canEdit: boolean;
}

/**
 * Rolle und daraus abgeleitete Rechte der angemeldeten Person im aktuellen
 * Roadtrip. Die Rolle kommt direkt aus der Mitgliedschaft
 * (roadtrips/{tripId}/members/{uid}, siehe useRoadtrip) – serverseitig
 * durchgesetzt wird sie in firestore.rules, nicht hier.
 *
 * Der Parameter ist nur für Abwärtskompatibilität vorhanden (Aufrufer
 * übergaben früher den Anzeigenamen) und wird nicht mehr ausgewertet.
 */
export function usePermissions(_currentUser?: string): Permissions {
  const { role: activeRole } = useRoadtrip();
  const role = activeRole ?? 'readonly';
  return {
    role,
    isOwner: role === 'owner',
    canManageCrew: canManageCrew(role),
    canDeleteRoadtrip: canDeleteRoadtrip(role),
    canEdit: canEdit(role)
  };
}
