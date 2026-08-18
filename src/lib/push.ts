import { deleteToken, getMessaging, getToken, isSupported, Messaging } from 'firebase/messaging';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { app, db } from '../firebase';
import { tripPath } from '../hooks/useRoadtrip';
import { PushTopics, withDefaults } from './pushTopics';

/**
 * Push-Benachrichtigungen über Firebase Cloud Messaging.
 *
 * Der Versand liegt in Cloud Functions (functions/src/index.ts) – hier geht es
 * nur darum, dieses Gerät als Empfänger an- oder abzumelden. Registrierungen
 * liegen unter roadtrips/{tripId}/devices/{deviceId}.
 */

const STORAGE_KEY_DEVICE_ID = 'boat_device_id';

/**
 * Stabile Kennung dieses Geräts. Bewusst nicht das FCM-Token als Dokument-Id:
 * Tokens rotieren (Browser-Update, Neuinstallation des Service Workers) und
 * hinterließen dann bei jedem Wechsel eine Karteileiche.
 */
export function getDeviceId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (stored) return stored;

  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(STORAGE_KEY_DEVICE_ID, created);
  return created;
}

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** true, wenn dieses Projekt überhaupt für Push konfiguriert ist. */
export function isPushConfigured(): boolean {
  return Boolean(vapidKey);
}

/**
 * Push braucht Service Worker, Notification API und Push API. iOS liefert das
 * erst ab 16.4 und ausschließlich für zum Home-Bildschirm hinzugefügte Apps –
 * im normalen Safari-Tab fehlt es, deshalb wird hier tatsächlich geprüft statt
 * auf den Browsernamen zu schauen.
 */
export async function isPushSupported(): Promise<boolean> {
  if (!isPushConfigured()) return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  return isSupported();
}

export type PermissionState = 'granted' | 'denied' | 'default';

export function currentPermission(): PermissionState {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission as PermissionState;
}

/**
 * Registriert den FCM-Service-Worker.
 *
 * Die Firebase-Config wird als Query-String übergeben: Der Worker liegt als
 * statische Datei in public/ und wird von Vite nicht transformiert, kommt also
 * nicht an import.meta.env heran. Die Werte sind ohnehin öffentlich (siehe
 * .env.example), es wird hier kein Geheimnis in eine URL geschrieben.
 *
 * Eigene Datei statt des PWA-Workers: Firebase erwartet den Handler unter
 * diesem Pfad, und der von vite-plugin-pwa erzeugte Worker wird bei jedem
 * Build neu generiert.
 */
async function registerMessagingWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`, {
    scope: '/firebase-cloud-messaging-push-scope'
  });
}

let messagingInstance: Messaging | null = null;

function messaging(): Messaging {
  if (!messagingInstance) messagingInstance = getMessaging(app);
  return messagingInstance;
}

export interface DeviceRegistration {
  token: string;
  user: string;
  topics: PushTopics;
  createdAt: number;
  updatedAt: number;
}

function deviceRef(tripId: string) {
  return doc(db, tripPath(tripId, 'devices'), getDeviceId());
}

/**
 * Fragt die Berechtigung ab, holt ein FCM-Token und hinterlegt dieses Gerät
 * als Empfänger. Gibt null zurück, wenn die Crew die Berechtigung ablehnt.
 */
export async function enablePush(
  tripId: string,
  user: string,
  topics: PushTopics
): Promise<string | null> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const serviceWorkerRegistration = await registerMessagingWorker();
  const token = await getToken(messaging(), { vapidKey, serviceWorkerRegistration });
  if (!token) return null;

  const existing = await getDoc(deviceRef(tripId));
  const now = Date.now();
  const registration: DeviceRegistration = {
    token,
    user,
    topics,
    createdAt: existing.exists() ? (existing.data().createdAt as number) : now,
    updatedAt: now
  };
  await setDoc(deviceRef(tripId), registration);
  return token;
}

/** Meldet dieses Gerät wieder ab und zieht das Token zurück. */
export async function disablePush(tripId: string): Promise<void> {
  // Erst das Dokument entfernen: Schlägt danach das Zurückziehen des Tokens
  // fehl, ist das Gerät trotzdem schon kein Empfänger mehr.
  await deleteDoc(deviceRef(tripId));
  try {
    await deleteToken(messaging());
  } catch (err) {
    console.error('FCM-Token konnte nicht zurückgezogen werden:', err);
  }
}

/** Ändert die abonnierten Themen dieses Geräts. */
export async function savePushTopics(tripId: string, topics: PushTopics): Promise<void> {
  await updateDoc(deviceRef(tripId), { topics, updatedAt: Date.now() });
}

/** Registrierung dieses Geräts, oder null wenn es nicht angemeldet ist. */
export async function readRegistration(tripId: string): Promise<DeviceRegistration | null> {
  const snapshot = await getDoc(deviceRef(tripId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as DeviceRegistration;
  return { ...data, topics: withDefaults(data.topics) };
}
