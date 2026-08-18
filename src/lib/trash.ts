/**
 * Weiches Löschen für Logbuch-Ereignisse und Ausgaben.
 *
 * Ein `deleteDoc` gegen Firestore ist sofort und endgültig – auf einem
 * Handy-Display neben dem Bearbeiten-Stift ist der Löschen-Knopf aber schnell
 * versehentlich getroffen. Gelöschte Einträge bekommen deshalb nur einen
 * Zeitstempel `deletedAt` und verschwinden aus den Listen; endgültig entfernt
 * werden sie erst im Papierkorb (manuell) oder nach Ablauf der Aufbewahrung.
 */

/** Aufbewahrungsdauer im Papierkorb, bevor ein Eintrag zum Löschen vorgeschlagen wird. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SoftDeletable {
  /** Zeitpunkt des Löschens, oder undefined solange der Eintrag aktiv ist. */
  deletedAt?: number;
}

export function isDeleted(item: SoftDeletable): boolean {
  return typeof item.deletedAt === 'number';
}

/** Die sichtbaren Einträge einer Collection. */
export function activeOnly<T extends SoftDeletable>(items: T[]): T[] {
  return items.filter((item) => !isDeleted(item));
}

/** Der Inhalt des Papierkorbs, zuletzt gelöschte zuerst. */
export function deletedOnly<T extends SoftDeletable>(items: T[]): T[] {
  return items.filter(isDeleted).sort((a, b) => b.deletedAt! - a.deletedAt!);
}

/** true, sobald ein Eintrag länger als die Aufbewahrungsdauer im Papierkorb liegt. */
export function isExpired(item: SoftDeletable, now: number = Date.now()): boolean {
  return isDeleted(item) && now - item.deletedAt! > TRASH_RETENTION_MS;
}

/** Verbleibende Aufbewahrungstage, aufgerundet und nie negativ. */
export function retentionDaysLeft(item: SoftDeletable, now: number = Date.now()): number {
  if (!isDeleted(item)) return 0;
  const remaining = TRASH_RETENTION_MS - (now - item.deletedAt!);
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}
