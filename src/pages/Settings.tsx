import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ListChecks,
  ShieldCheck,
  ChevronRight,
  Wifi,
  WifiOff,
  LogOut,
  DoorOpen,
  Compass,
  Download,
  Trash2
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePreferences } from '../hooks/usePreferences';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { leaveRoadtrip } from '../lib/roadtrip';
import { useQuickLogs } from '../hooks/useSettings';
import { getUserColor } from '../lib/userColors';
import { UnitSystem } from '../lib/units';
import { BASE_LAYERS, BASE_LAYER_IDS, OVERLAYS, OVERLAY_IDS, BaseLayerId } from '../lib/mapLayers';
import {
  Button,
  Section,
  Badge,
  PageHeader,
  Toggle,
  SegmentedControl,
  Select
} from '../components/ui';
import './Settings.css';

interface Props {
  currentUser: string;
  users: string[];
  onLogout: () => void;
}

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'km/h' },
  { value: 'nautical', label: 'kn' }
];

const TRACK_INTERVALS = [
  { value: 10_000, label: 'Alle 10 Sekunden' },
  { value: 30_000, label: 'Alle 30 Sekunden' },
  { value: 60_000, label: 'Jede Minute' },
  { value: 300_000, label: 'Alle 5 Minuten' }
];

function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-body">
        <div className="setting-row-label">{label}</div>
        {description && <div className="helper-text">{description}</div>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function SettingLink({
  to,
  icon,
  label,
  value
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link to={to} className="setting-row setting-link">
      <span className="setting-link-icon">{icon}</span>
      <div className="setting-row-body">
        <div className="setting-row-label">{label}</div>
        <div className="helper-text">{value}</div>
      </div>
      <ChevronRight size={18} className="setting-link-chevron" />
    </Link>
  );
}

export default function Settings({ currentUser, users, onLogout }: Props) {
  const isOnline = useOnlineStatus();
  const quickLogs = useQuickLogs();
  const { preferences, setPreference } = usePreferences();
  const { tripName } = useRoadtrip();

  const handleLeaveRoadtrip = async () => {
    // Profil zuerst abmelden, damit das Gerät nicht mit dem Nutzernamen
    // eines fremden Roadtrips im Gate landet.
    onLogout();
    try {
      await leaveRoadtrip();
    } catch (err) {
      console.error('Roadtrip konnte nicht verlassen werden:', err);
    }
  };

  return (
    <div className="settings-page">
      <PageHeader title="Einstellungen" subtitle="Gerät, Anzeige und Daten dieser Reise" />

      <Section title="Dieser Roadtrip">
        <div className="setting-row">
          <span className="setting-link-icon">
            <Compass size={18} strokeWidth={1.75} />
          </span>
          <div className="setting-row-body">
            <div className="setting-row-label">{tripName ?? '…'}</div>
            <div className="helper-text">Nur mit Roadtrip-Passwort erreichbar</div>
          </div>
        </div>
      </Section>

      <Section title="Dieses Gerät">
        <div className="setting-row">
          <span className="avatar" style={{ background: getUserColor(currentUser), color: '#ffffff' }}>
            {currentUser.charAt(0).toUpperCase()}
          </span>
          <div className="setting-row-body">
            <div className="setting-row-label">{currentUser}</div>
            <div className="helper-text">Angemeldetes Profil</div>
          </div>
          <div className="setting-row-control">
            <Badge tone={isOnline ? 'success' : 'danger'} dot>
              {isOnline ? 'Live-Sync' : 'Offline'}
            </Badge>
          </div>
        </div>

        <p className="helper-text setting-note">
          {isOnline
            ? 'Änderungen werden sofort mit der Crew synchronisiert.'
            : 'Änderungen werden lokal gespeichert und synchronisiert, sobald wieder Empfang besteht.'}
          {isOnline ? <Wifi size={13} className="setting-note-icon" /> : <WifiOff size={13} className="setting-note-icon" />}
        </p>
      </Section>

      <Section title="Anzeige">
        <SettingRow label="Einheiten" description="Geschwindigkeit und Strecke in der ganzen App">
          <SegmentedControl
            label="Einheiten"
            value={preferences.unitSystem}
            options={UNIT_OPTIONS}
            onChange={(value) => setPreference('unitSystem', value)}
          />
        </SettingRow>

      </Section>

      <Section title="Karte">
        <SettingRow label="Grundkarte" description={BASE_LAYERS[preferences.baseLayer].description}>
          <Select
            className="setting-select"
            aria-label="Grundkarte"
            value={preferences.baseLayer}
            onChange={(e) => setPreference('baseLayer', e.target.value as BaseLayerId)}
          >
            {BASE_LAYER_IDS.map((id) => (
              <option key={id} value={id}>
                {BASE_LAYERS[id].label}
              </option>
            ))}
          </Select>
        </SettingRow>

        {OVERLAY_IDS.map((id) => (
          <SettingRow key={id} label={OVERLAYS[id].label} description={OVERLAYS[id].description}>
            <Toggle
              label={`${OVERLAYS[id].label} auf der Karte anzeigen`}
              checked={preferences.overlays[id]}
              onChange={(value) =>
                setPreference('overlays', { ...preferences.overlays, [id]: value })
              }
            />
          </SettingRow>
        ))}

        <p className="helper-text setting-note">
          Ebenen liegen übereinander – die Grundkarte unten, jedes aktive Overlay darüber.
        </p>
      </Section>

      <Section title="Aufzeichnung">
        <SettingRow
          label="Trackpunkte"
          description="Seltener spart Akku und mobile Daten, häufiger zeichnet genauer auf."
        >
          <Select
            className="setting-select"
            aria-label="Abstand zwischen Trackpunkten"
            value={preferences.trackIntervalMs}
            onChange={(e) => setPreference('trackIntervalMs', Number(e.target.value))}
          >
            {TRACK_INTERVALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </SettingRow>
      </Section>

      <Section title="Verwaltung">
        <div className="settings-list">
          <SettingLink
            to="/settings/crew"
            icon={<Users size={18} strokeWidth={1.75} />}
            label="Crew"
            value={`${users.length} ${users.length === 1 ? 'Mitglied' : 'Mitglieder'}`}
          />
          <SettingLink
            to="/settings/quicklogs"
            icon={<ListChecks size={18} strokeWidth={1.75} />}
            label="Schnell-Logs"
            value={`${quickLogs.length} ${quickLogs.length === 1 ? 'Kategorie' : 'Kategorien'}`}
          />
        </div>
      </Section>

      <Section title="Daten">
        <div className="settings-list">
          <SettingLink
            to="/settings/export"
            icon={<Download size={18} strokeWidth={1.75} />}
            label="Export"
            value="Bericht als PDF, CSV und GPX"
          />
          <SettingLink
            to="/settings/papierkorb"
            icon={<Trash2 size={18} strokeWidth={1.75} />}
            label="Papierkorb"
            value="Gelöschtes wiederherstellen"
          />
        </div>
      </Section>

      <Section title="Rechtliches">
        <div className="settings-list">
          <SettingLink
            to="/datenschutz"
            icon={<ShieldCheck size={18} strokeWidth={1.75} />}
            label="Datenschutz"
            value="GPS, Namen und Kosten"
          />
        </div>
      </Section>

      <Section title="App">
        <SettingRow label="Version" description="2cars2georgia">
          <span className="mono-num helper-text">{__APP_VERSION__}</span>
        </SettingRow>
        <div className="stack">
          <Button variant="secondary" fullWidth onClick={onLogout}>
            <LogOut size={18} /> Profil abmelden
          </Button>
          <Button variant="destructive" fullWidth onClick={handleLeaveRoadtrip}>
            <DoorOpen size={18} /> Roadtrip verlassen
          </Button>
        </div>
      </Section>
    </div>
  );
}
