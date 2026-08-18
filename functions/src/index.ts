import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, TokenMessage } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import {
  buildEventNotification,
  buildExpenseNotification,
  buildStalledNotification,
  findStalledSessions,
  selectRecipients,
  DeviceRegistration,
  Notification,
  TrackingSession,
  STALL_THRESHOLD_MS
} from './notifications';

initializeApp();
const db = getFirestore();

// Europa, passend zur üblichen Firestore-Region des Projekts – Functions und
// Datenbank in derselben Region sparen Latenz und Egress-Kosten.
const REGION = 'europe-west1';

/**
 * FCM meldet abgelaufene oder zurückgezogene Tokens mit diesen Codes. Solche
 * Registrierungen sind dauerhaft tot (App deinstalliert, Browserdaten
 * gelöscht) und werden entfernt, statt bei jedem Ereignis erneut zu scheitern.
 */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

async function loadDevices(tripId: string): Promise<(DeviceRegistration & { id: string })[]> {
  const snapshot = await db.collection(`roadtrips/${tripId}/devices`).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as DeviceRegistration) }));
}

/**
 * Verschickt eine Meldung an alle passenden Geräte eines Roadtrips und räumt
 * dabei tote Registrierungen ab.
 */
async function sendToTrip(
  tripId: string,
  notification: Notification,
  excludeUser?: string
): Promise<void> {
  const devices = await loadDevices(tripId);
  const recipients = selectRecipients(devices, notification.topic, excludeUser);

  if (recipients.length === 0) {
    logger.info('Keine Empfänger', { tripId, topic: notification.topic });
    return;
  }

  const messages: TokenMessage[] = recipients.map((device) => ({
    token: device.token,
    notification: { title: notification.title, body: notification.body },
    // Das Ziel muss durch den Service Worker bis in den Klick-Handler
    // durchgereicht werden, deshalb als data statt nur als notification.
    data: { path: notification.path, topic: notification.topic },
    webpush: {
      fcmOptions: { link: notification.path },
      notification: {
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        // Meldungen desselben Themas ersetzen einander, statt den
        // Sperrbildschirm zuzustapeln.
        tag: notification.topic,
        requireInteraction: notification.topic === 'emergency'
      }
    }
  }));

  const response = await getMessaging().sendEach(messages);

  const cleanups = response.responses.flatMap((result, index) => {
    if (result.success) return [];
    const code = (result.error as { code?: string } | undefined)?.code ?? '';
    if (!DEAD_TOKEN_ERRORS.has(code)) {
      logger.warn('Zustellung fehlgeschlagen', { tripId, code });
      return [];
    }
    logger.info('Entferne totes Gerät', { tripId, code });
    return [db.doc(`roadtrips/${tripId}/devices/${recipients[index].id}`).delete()];
  });

  await Promise.all(cleanups);

  logger.info('Meldung verschickt', {
    tripId,
    topic: notification.topic,
    erfolgreich: response.successCount,
    fehlgeschlagen: response.failureCount
  });
}

/** Anzeigename einer Schnell-Log-Kategorie, mit der rohen Id als Rückfall. */
async function categoryLabel(tripId: string, type: string): Promise<string> {
  const snapshot = await db.doc(`roadtrips/${tripId}/settings/quicklogs`).get();
  const items = (snapshot.data()?.items ?? []) as { id: string; label: string }[];
  return items.find((item) => item.id === type)?.label ?? type;
}

/**
 * Neue Ausgabe → die übrige Crew informieren. Genau der Fall, für den die
 * Reisekasse sonst erst beim nächsten Öffnen der App auffällt.
 */
export const onExpenseCreated = onDocumentCreated(
  { document: 'roadtrips/{tripId}/expenses/{expenseId}', region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Ein Eintrag, der direkt im Papierkorb landet, ist ein Sync-Nachzügler
    // und keine Neuigkeit.
    if (data.deletedAt !== undefined) return;

    await sendToTrip(
      event.params.tripId,
      buildExpenseNotification({
        title: data.title,
        amountEuro: data.amountEuro,
        author: data.author,
        paidBy: data.paidBy
      }),
      data.author
    );
  }
);

/** Neues Logbuch-Ereignis → die übrige Crew informieren. */
export const onEventCreated = onDocumentCreated(
  { document: 'roadtrips/{tripId}/events/{eventId}', region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.deletedAt !== undefined) return;

    const { tripId } = event.params;
    await sendToTrip(
      tripId,
      buildEventNotification({
        title: data.title,
        author: data.author,
        categoryLabel: await categoryLabel(tripId, data.type)
      }),
      data.author
    );
  }
);

/**
 * Notfall-Wächter: Läuft eine Aufzeichnung, kommen aber keine Positionen mehr
 * an, erfährt die Crew davon – Motorschaden, leerer Akku oder Schlimmeres
 * sehen von außen erst einmal gleich aus.
 *
 * Die Abfrage geht über eine Collection-Group, damit ein Lauf alle Roadtrips
 * abdeckt statt sie einzeln durchzugehen.
 */
export const checkStalledTracking = onSchedule(
  { schedule: 'every 5 minutes', region: REGION, timeZone: 'Europe/Berlin' },
  async () => {
    const now = Date.now();
    const snapshot = await db
      .collectionGroup('tracking')
      .where('active', '==', true)
      .where('lastPointAt', '<', now - STALL_THRESHOLD_MS)
      .get();

    if (snapshot.empty) return;

    // Nach Roadtrip bündeln: Die Geräteliste wird pro Trip nur einmal geladen.
    const byTrip = new Map<string, { session: TrackingSession; ref: FirebaseFirestore.DocumentReference }[]>();
    for (const doc of snapshot.docs) {
      // .../roadtrips/{tripId}/tracking/{user}
      const tripId = doc.ref.parent.parent?.id;
      if (!tripId) continue;
      const entry = { session: doc.data() as TrackingSession, ref: doc.ref };
      byTrip.set(tripId, [...(byTrip.get(tripId) ?? []), entry]);
    }

    for (const [tripId, entries] of byTrip) {
      // Die Abfrage kann die Einmal-pro-Stille-Regel nicht ausdrücken
      // (Firestore vergleicht keine zwei Felder miteinander), deshalb hier.
      const stalled = findStalledSessions(
        entries.map((entry) => entry.session),
        now
      );

      for (const session of stalled) {
        const entry = entries.find((candidate) => candidate.session.user === session.user)!;
        await sendToTrip(tripId, buildStalledNotification(session.user, now - session.lastPointAt));
        await entry.ref.update({ alertedAt: now });
      }
    }
  }
);

/**
 * Hält die Geräteliste sauber: Registrierungen, die sich ein halbes Jahr nicht
 * gemeldet haben, gehören zu Geräten, die den Roadtrip längst hinter sich
 * haben.
 */
export const pruneStaleDevices = onSchedule(
  { schedule: 'every day 04:00', region: REGION, timeZone: 'Europe/Berlin' },
  async () => {
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const snapshot = await db
      .collectionGroup('devices')
      .where('updatedAt', '<', cutoff)
      .get();

    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    logger.info('Alte Geräte entfernt', { anzahl: snapshot.size });
  }
);
