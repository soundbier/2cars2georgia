import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ConfirmDialog, useToast } from './components/ui';

/** Wie oft aktiv geprüft wird, ob am Repo etwas geändert und neu deployt wurde. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Zeigt einen Bestätigungsscreen, sobald Cloudflare eine neue Version
 * deployt hat, und übernimmt sie erst nach Zustimmung der Crew.
 *
 * Der Browser prüft von sich aus nur bei einer Navigation (Neuladen/
 * Neuöffnen) auf ein neues sw.js. Solange die App als PWA offen bleibt,
 * würde ein Update sonst unbemerkt liegen bleiben – deshalb wird hier
 * zusätzlich stündlich und beim Zurückkehren in den Vordergrund aktiv
 * nachgefragt.
 */
export function UpdatePrompt() {
  const { notify } = useToast();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      const checkForUpdate = () => registration.update().catch(() => {});
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
    onRegisterError(err) {
      console.error('Service-Worker-Registrierung fehlgeschlagen:', err);
    }
  });

  useEffect(() => {
    if (!offlineReady) return;
    notify('App ist bereit für die Offline-Nutzung.', 'success');
    setOfflineReady(false);
  }, [offlineReady, notify, setOfflineReady]);

  return (
    <ConfirmDialog
      open={needRefresh}
      title="Update verfügbar"
      description="Es gibt eine neue Version von 2cars2georgia. Ein kurzer Neustart lädt sie – bereits erfasste Daten bleiben erhalten."
      confirmLabel="Jetzt aktualisieren"
      cancelLabel="Später"
      onConfirm={() => updateServiceWorker(true)}
      onCancel={() => setNeedRefresh(false)}
    />
  );
}
