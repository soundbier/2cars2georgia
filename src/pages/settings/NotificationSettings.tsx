import { BellRing, BellOff, Smartphone } from 'lucide-react';
import { usePush } from '../../hooks/usePush';
import { PUSH_TOPIC_IDS, PUSH_TOPIC_META } from '../../lib/pushTopics';
import { Button, Section, PageHeader, Toggle } from '../../components/ui';
import '../Settings.css';

export default function NotificationSettings({ currentUser }: { currentUser: string }) {
  const { supported, configured, permission, enabled, topics, busy, enable, disable, setTopic } =
    usePush(currentUser);

  return (
    <div className="settings-page">
      <PageHeader
        title="Benachrichtigungen"
        subtitle="Push auf dieses Gerät, wenn an Bord etwas passiert"
        backTo="/settings"
        backLabel="Einstellungen"
      />

      {!configured ? (
        <Section title="Nicht eingerichtet">
          <p className="helper-text setting-note">
            Für dieses Projekt ist kein Web-Push-Schlüssel hinterlegt
            (<code>VITE_FIREBASE_VAPID_KEY</code>). Solange der fehlt, kann die App keine
            Benachrichtigungen empfangen – siehe README.
          </p>
        </Section>
      ) : supported === false ? (
        <Section title="Auf diesem Gerät nicht möglich">
          <p className="helper-text setting-note">
            Dieser Browser unterstützt keine Web-Push-Benachrichtigungen. Auf dem iPhone
            funktionieren sie erst, wenn die App über „Zum Home-Bildschirm“ installiert und von dort
            gestartet wird – im normalen Safari-Tab nicht.
          </p>
        </Section>
      ) : (
        <>
          <Section title="Dieses Gerät">
            <div className="setting-row">
              <span className="setting-link-icon">
                <Smartphone size={18} strokeWidth={1.75} />
              </span>
              <div className="setting-row-body">
                <div className="setting-row-label">
                  {enabled ? 'Benachrichtigungen aktiv' : 'Keine Benachrichtigungen'}
                </div>
                <div className="helper-text">
                  {enabled
                    ? `Meldungen erreichen dieses Gerät als ${currentUser}.`
                    : 'Push muss auf jedem Gerät einzeln erlaubt werden.'}
                </div>
              </div>
            </div>

            {permission === 'denied' && !enabled ? (
              <p className="helper-text setting-note">
                Benachrichtigungen sind für diese Seite im Browser blockiert. Das lässt sich nur in
                den Website-Einstellungen des Browsers zurücknehmen – die App kann nicht erneut
                fragen.
              </p>
            ) : enabled ? (
              <Button variant="secondary" fullWidth disabled={busy} onClick={disable}>
                <BellOff size={18} /> Benachrichtigungen ausschalten
              </Button>
            ) : (
              <Button fullWidth disabled={busy || supported === null} onClick={enable}>
                <BellRing size={18} /> Benachrichtigungen einschalten
              </Button>
            )}
          </Section>

          <Section title="Wobei melden">
            {PUSH_TOPIC_IDS.map((id) => (
              <div key={id} className="setting-row">
                <div className="setting-row-body">
                  <div className="setting-row-label">{PUSH_TOPIC_META[id].label}</div>
                  <div className="helper-text">{PUSH_TOPIC_META[id].description}</div>
                </div>
                <div className="setting-row-control">
                  <Toggle
                    label={PUSH_TOPIC_META[id].label}
                    checked={topics[id]}
                    disabled={busy}
                    onChange={(value) => setTopic(id, value)}
                  />
                </div>
              </div>
            ))}
            <p className="helper-text setting-note">
              Über eigene Einträge wird nie benachrichtigt – nur über die der übrigen Crew.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
