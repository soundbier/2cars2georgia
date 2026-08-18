import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from './i18n';
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
  const t = useT();

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
    notify(t('update.offlineReady'), 'success');
    setOfflineReady(false);
  }, [offlineReady, notify, setOfflineReady, t]);

  return (
    <ConfirmDialog
      open={needRefresh}
      title={t('update.title')}
      description={t('update.description')}
      confirmLabel={t('update.confirm')}
      cancelLabel={t('update.later')}
      onConfirm={() => updateServiceWorker(true)}
      onCancel={() => setNeedRefresh(false)}
    />
  );
}
