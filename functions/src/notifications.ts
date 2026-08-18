/**
 * Reine Logik der Push-Benachrichtigungen: Welcher Text wird verschickt, und
 * welche Aufzeichnung gilt als stillstehend?
 *
 * Bewusst ohne Import von firebase-functions/firebase-admin, damit sich alles
 * ohne Emulator und ohne Firebase-Projekt testen lässt (siehe
 * notifications.test.ts, läuft im normalen `npm test` des Projekts mit).
 */

/** Themen, die ein Gerät einzeln abonnieren kann (siehe src/lib/pushTopics.ts). */
export type PushTopic = 'expenses' | 'events' | 'emergency';

export interface Notification {
  title: string;
  body: string;
  /** Ziel innerhalb der App, das beim Antippen geöffnet wird. */
  path: string;
  topic: PushTopic;
}

/**
 * Beträge im Push immer mit zwei Nachkommastellen und Komma – die Meldung
 * landet auf einem deutschsprachigen Sperrbildschirm, nicht in einer CSV.
 */
export function formatAmount(amountEuro: number): string {
  return `${amountEuro.toFixed(2).replace('.', ',')} €`;
}

export interface ExpenseNotificationInput {
  title: string;
  amountEuro: number;
  author: string;
  paidBy: string;
}

export function buildExpenseNotification(expense: ExpenseNotificationInput): Notification {
  // "Bezahlt von" weicht oft vom Erfasser ab (Bordkasse, jemand anderes hat
  // ausgelegt). Beides in den Text zu quetschen macht ihn unlesbar, deshalb
  // steht der Zahler nur dann dabei, wenn er nicht der Erfasser ist.
  const payer = expense.paidBy === expense.author ? '' : ` · bezahlt von ${expense.paidBy}`;
  return {
    title: `Neue Ausgabe: ${formatAmount(expense.amountEuro)}`,
    body: `${expense.author} hat „${expense.title}“ eingetragen${payer}.`,
    path: '/costs',
    topic: 'expenses'
  };
}

export interface EventNotificationInput {
  title: string;
  author: string;
  /** Anzeigename der Kategorie, oder die rohe Id wenn sie gelöscht wurde. */
  categoryLabel: string;
}

export function buildEventNotification(event: EventNotificationInput): Notification {
  return {
    title: `Logbuch: ${event.categoryLabel}`,
    body: `${event.author} hat „${event.title}“ protokolliert.`,
    path: '/stats',
    topic: 'events'
  };
}

export function buildStalledNotification(user: string, silentMs: number): Notification {
  const minutes = Math.round(silentMs / 60_000);
  return {
    title: `Keine Position von ${user}`,
    body:
      `Die Aufzeichnung läuft, aber seit ${minutes} Minuten kam kein Standort mehr an. ` +
      'Kurz nachsehen, ob an Bord alles in Ordnung ist.',
    path: '/map',
    topic: 'emergency'
  };
}

/**
 * Aufzeichnungssitzung eines Crewmitglieds, wie sie unter
 * roadtrips/{tripId}/tracking/{user} liegt.
 */
export interface TrackingSession {
  user: string;
  /** true, solange „Tour läuft“ auf dem Gerät aktiv ist. */
  active: boolean;
  /** Zeitpunkt des zuletzt gespeicherten Trackpunkts. */
  lastPointAt: number;
  /** Zeitpunkt der letzten Stillstands-Warnung, falls schon eine raus ging. */
  alertedAt?: number;
}

/**
 * Nach dieser Stille bei laufender Aufzeichnung wird gewarnt.
 *
 * Deutlich über dem größten wählbaren Trackpunkt-Intervall (5 Minuten, siehe
 * Einstellungen), damit eine kurze Funklücke unter einer Brücke oder im
 * Schleusenkanal keinen Fehlalarm auslöst.
 */
export const STALL_THRESHOLD_MS = 20 * 60 * 1000;

/**
 * Sitzungen, für die jetzt eine Warnung fällig ist.
 *
 * `alertedAt > lastPointAt` ist der Riegel gegen Dauerwarnungen: Nach der
 * ersten Meldung liegt der Warnzeitpunkt hinter dem letzten Punkt, es kommt
 * also keine weitere – bis ein neuer Trackpunkt eintrifft und die Stille
 * damit von vorn beginnt.
 */
export function findStalledSessions(
  sessions: TrackingSession[],
  now: number,
  thresholdMs: number = STALL_THRESHOLD_MS
): TrackingSession[] {
  return sessions.filter((session) => {
    if (!session.active) return false;
    if (now - session.lastPointAt < thresholdMs) return false;
    return session.alertedAt === undefined || session.alertedAt <= session.lastPointAt;
  });
}

/**
 * Empfänger einer Meldung: alle Geräte des Roadtrips, die das Thema
 * abonniert haben – außer den Geräten der auslösenden Person selbst. Über die
 * eigene Eingabe benachrichtigt zu werden ist nur lästig.
 */
export interface DeviceRegistration {
  token: string;
  user: string;
  topics: Record<PushTopic, boolean>;
}

export function selectRecipients<T extends DeviceRegistration>(
  devices: T[],
  topic: PushTopic,
  excludeUser?: string
): T[] {
  return devices.filter(
    (device) => device.topics?.[topic] === true && device.user !== excludeUser
  );
}
