/*
 * Service Worker für Push-Benachrichtigungen im Hintergrund.
 *
 * Firebase Cloud Messaging erwartet den Handler unter genau diesem Pfad. Die
 * Datei liegt deshalb in public/ und wird unverändert ausgeliefert – Vite
 * transformiert sie nicht, sie kommt also weder an import.meta.env noch an das
 * npm-Paket heran. Daher: Konfiguration aus dem Query-String der Registrierung
 * (siehe src/lib/push.ts) und Firebase über die compat-Skripte vom CDN.
 *
 * Der PWA-Service-Worker (vite-plugin-pwa) bleibt davon unberührt: Dieser hier
 * läuft im eigenen Scope /firebase-cloud-messaging-push-scope.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId')
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  self.registration.showNotification(title, {
    body,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: payload.data?.topic,
    requireInteraction: payload.data?.topic === 'emergency',
    data: { path: payload.data?.path ?? '/' }
  });
});

/**
 * Tippen auf die Meldung öffnet die passende Stelle in der App. Ist bereits
 * ein Fenster offen, wird es nach vorn geholt und dorthin navigiert, statt ein
 * zweites daneben zu stellen.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.path ?? '/';
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
          return client.navigate(target).then((navigated) => navigated?.focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
