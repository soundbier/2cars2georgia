import { describe, it, expect } from 'vitest';
import { canDeleteRoadtrip, canEdit, canManageCrew, countOwners } from './permissions';

describe('canManageCrew / canEdit / canDeleteRoadtrip', () => {
  it('erlaubt Crew-Verwaltung nur Ownern', () => {
    expect(canManageCrew('owner')).toBe(true);
    expect(canManageCrew('member')).toBe(false);
    expect(canManageCrew('readonly')).toBe(false);
  });

  it('erlaubt Bearbeiten allen außer Read-only', () => {
    expect(canEdit('owner')).toBe(true);
    expect(canEdit('member')).toBe(true);
    expect(canEdit('readonly')).toBe(false);
  });

  it('erlaubt endgültiges Löschen nur dem Owner', () => {
    expect(canDeleteRoadtrip('owner')).toBe(true);
    expect(canDeleteRoadtrip('member')).toBe(false);
    expect(canDeleteRoadtrip('readonly')).toBe(false);
  });
});

describe('countOwners', () => {
  it('zählt Mitglieder mit Owner-Rolle', () => {
    const members = [
      { role: 'owner' as const },
      { role: 'owner' as const },
      { role: 'member' as const }
    ];
    expect(countOwners(members)).toBe(2);
  });

  it('liefert 0 ohne Owner', () => {
    expect(countOwners([{ role: 'member' as const }, { role: 'readonly' as const }])).toBe(0);
  });

  it('lässt eine leere Liste ohne Absturz zu', () => {
    expect(countOwners([])).toBe(0);
  });
});
