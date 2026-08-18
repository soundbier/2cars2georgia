import { describe, it, expect } from 'vitest';
import { canEdit, canManageCrew, countOwners, getEffectiveRole } from './permissions';

describe('getEffectiveRole', () => {
  it('behandelt das erste Crewmitglied ohne roles-Feld als impliziten Owner', () => {
    const users = ['Lukas', 'Leon', 'Niklas'];
    expect(getEffectiveRole(users, undefined, 'Lukas')).toBe('owner');
    expect(getEffectiveRole(users, undefined, 'Leon')).toBe('member');
    expect(getEffectiveRole(users, {}, 'Niklas')).toBe('member');
  });

  it('nutzt eine explizit gespeicherte Rolle, wenn vorhanden', () => {
    const users = ['Lukas', 'Leon'];
    const roles = { Lukas: 'readonly' as const, Leon: 'owner' as const };
    expect(getEffectiveRole(users, roles, 'Lukas')).toBe('readonly');
    expect(getEffectiveRole(users, roles, 'Leon')).toBe('owner');
  });

  it('greift nicht mehr auf den impliziten Owner zurück, sobald irgendwo einer explizit vergeben ist', () => {
    const users = ['Lukas', 'Leon'];
    // Leon ist explizit Owner, Lukas hat keinen Eintrag -> ist trotz erster
    // Position in der Liste kein automatischer Owner mehr.
    const roles = { Leon: 'owner' as const };
    expect(getEffectiveRole(users, roles, 'Lukas')).toBe('member');
  });

  it('lässt eine leere Crew-Liste ohne Absturz zu', () => {
    expect(getEffectiveRole([], undefined, 'Lukas')).toBe('member');
  });
});

describe('canManageCrew / canEdit', () => {
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
});

describe('countOwners', () => {
  it('zählt den impliziten Owner mit, solange keiner explizit vergeben ist', () => {
    expect(countOwners(['Lukas', 'Leon'], undefined)).toBe(1);
  });

  it('zählt mehrere explizite Owner', () => {
    const roles = { Lukas: 'owner' as const, Leon: 'owner' as const, Niklas: 'member' as const };
    expect(countOwners(['Lukas', 'Leon', 'Niklas'], roles)).toBe(2);
  });

  it('kann auf null fallen, wenn der einzige explizite Owner degradiert wurde', () => {
    const roles = { Lukas: 'member' as const, Leon: 'readonly' as const };
    expect(countOwners(['Lukas', 'Leon'], roles)).toBe(0);
  });
});
