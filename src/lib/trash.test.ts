import { describe, it, expect } from 'vitest';
import {
  activeOnly,
  deletedOnly,
  isDeleted,
  isExpired,
  retentionDaysLeft,
  TRASH_RETENTION_MS
} from './trash';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('trash', () => {
  it('erkennt gelöschte Einträge am Zeitstempel', () => {
    expect(isDeleted({})).toBe(false);
    expect(isDeleted({ deletedAt: NOW })).toBe(true);
    // 0 wäre ein gültiger Zeitstempel-Typ, aber kein plausibler Wert – der Typ
    // entscheidet, damit ein zurückgesetzter Eintrag nur ohne Feld aktiv ist.
    expect(isDeleted({ deletedAt: undefined })).toBe(false);
  });

  it('trennt aktive Einträge vom Papierkorb', () => {
    const items = [{ id: 'a' }, { id: 'b', deletedAt: NOW }, { id: 'c' }];

    expect(activeOnly(items).map((i) => i.id)).toEqual(['a', 'c']);
    expect(deletedOnly(items).map((i) => i.id)).toEqual(['b']);
  });

  it('sortiert den Papierkorb mit den zuletzt gelöschten zuerst', () => {
    const items = [
      { id: 'alt', deletedAt: NOW - 2 * DAY },
      { id: 'neu', deletedAt: NOW },
      { id: 'mittel', deletedAt: NOW - DAY }
    ];

    expect(deletedOnly(items).map((i) => i.id)).toEqual(['neu', 'mittel', 'alt']);
  });

  it('markiert Einträge erst nach Ablauf der Aufbewahrung als abgelaufen', () => {
    expect(isExpired({ deletedAt: NOW - TRASH_RETENTION_MS + DAY }, NOW)).toBe(false);
    expect(isExpired({ deletedAt: NOW - TRASH_RETENTION_MS - DAY }, NOW)).toBe(true);
    expect(isExpired({}, NOW)).toBe(false);
  });

  it('zählt die verbleibenden Aufbewahrungstage herunter', () => {
    expect(retentionDaysLeft({ deletedAt: NOW }, NOW)).toBe(30);
    expect(retentionDaysLeft({ deletedAt: NOW - 29 * DAY }, NOW)).toBe(1);
    expect(retentionDaysLeft({ deletedAt: NOW - 60 * DAY }, NOW)).toBe(0);
    expect(retentionDaysLeft({}, NOW)).toBe(0);
  });
});
