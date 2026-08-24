import { ReactNode, useState } from 'react';
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
import { usePreferences, QUICK_LOG_ROW_OPTIONS } from '../hooks/usePreferences';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { usePermissions } from '../hooks/usePermissions';
import { signOutAccount } from '../lib/authAccount';
import { deleteRoadtripCascade } from '../lib/membership';
import { useQuickLogs } from '../hooks/useSettings';
import { ROLE_LABEL_KEY } from '../lib/permissions';
import { getUserColor } from '../lib/userColors';
import { UnitSystem } from '../lib/units';
import { useI18n, useT, LANGUAGES, Language, TranslationKey } from '../i18n';
import { BASE_LAYER_IDS, OVERLAY_IDS, BaseLayerId } from '../lib/mapLayers';
import {
  Button,
  Section,
  Badge,
  PageHeader,
  Toggle,
  SegmentedControl,
  Select,
  ConfirmDialog,
  useToast
} from '../components/ui';
import { SettingsSectionNav } from '../components/SettingsSectionNav';
import './Settings.css';

interface Props {
  currentUser: string;
  users: string[];
}

// Einheitenkürzel sind international dieselben und bleiben deshalb hier.
const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'km/h' },
  { value: 'nautical', label: 'kn' }
];

const TRACK_INTERVALS: { value: number; labelKey: TranslationKey }[] = [
  { value: 10_000, labelKey: 'settings.interval10s' },
  { value: 30_000, labelKey: 'settings.interval30s' },
  { value: 60_000, labelKey: 'settings.interval60s' },
  { value: 300_000, labelKey: 'settings.interval300s' }
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

export default function Settings({ currentUser, users }: Props) {
  const isOnline = useOnlineStatus();
  const quickLogs = useQuickLogs();
  const { preferences, setPreference } = usePreferences();
  const { tripId, tripName, authUser, clearTrip } = useRoadtrip();
  const { role, canDeleteRoadtrip } = usePermissions(currentUser);
  const { language, setLanguage } = useI18n();
  const { notify } = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = useT();

  // Nur die Auswahl auf diesem Gerät zurücksetzen – die Mitgliedschaft
  // (roadtrips/{tripId}/members/{uid}) bleibt bestehen, ein erneutes
  // Beitreten über die Roadtrip-ID reicht.
  const handleLeaveRoadtrip = () => {
    clearTrip();
  };

  // Meldet das Konto ab (signOut). Kein manuelles Weiterleiten nötig: der
  // onAuthStateChanged in useRoadtrip meldet den fehlenden Auth-User, und
  // AppGate blendet auf den Login-Screen um – dort kann direkt ein anderes
  // Konto angemeldet werden. Roadtrip- und Gerätedaten bleiben erhalten.
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutAccount();
    } catch (err) {
      console.error('Abmelden fehlgeschlagen:', err);
      notify(t('settings.logoutFailed'), 'danger');
      setSigningOut(false);
    }
  };

  const handleDeleteRoadtrip = async () => {
    if (!tripId || !authUser || deleting) return;
    setDeleting(true);
    try {
      await deleteRoadtripCascade(tripId, authUser.uid);
      // Kein manuelles Weiterleiten nötig: Der eigene onSnapshot auf
      // members/{uid} in useRoadtrip stellt fest, dass die Mitgliedschaft
      // weg ist, und blendet zurück auf das Roadtrip-Gate um.
    } catch (err) {
      console.error('Roadtrip konnte nicht gelöscht werden:', err);
      notify(t('trip.deleteFailed'), 'danger');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    /* `settings-page-columns`: Die Übersichtsseite besteht aus vielen kurzen
       Abschnitten und darf ab Laptopbreite zweispaltig laufen (siehe
       Settings.css). Die Unterseiten behalten die einspaltige Liste. */
    <div className="settings-page settings-page-columns">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <SettingsSectionNav />

      <Section title={t('settings.thisRoadtrip')}>
        <div className="setting-row">
          <span className="setting-link-icon">
            <Compass size={18} strokeWidth={1.75} />
          </span>
          <div className="setting-row-body">
            <div className="setting-row-label">{tripName ?? '…'}</div>
            <div className="helper-text">{t('settings.roadtripProtected')}</div>
          </div>
        </div>
      </Section>

      <Section title={t('settings.thisDevice')}>
        <div className="setting-row">
          <span className="avatar" style={{ background: getUserColor(currentUser), color: '#ffffff' }}>
            {currentUser.charAt(0).toUpperCase()}
          </span>
          <div className="setting-row-body">
            <div className="setting-row-label">{currentUser}</div>
            <div className="helper-text">{t('settings.signedInProfile')}</div>
          </div>
          <div className="setting-row-control row">
            <Badge tone={role === 'owner' ? 'success' : 'neutral'}>{t(ROLE_LABEL_KEY[role])}</Badge>
            <Badge tone={isOnline ? 'success' : 'danger'} dot>
              {isOnline ? t('settings.liveSync') : t('settings.offline')}
            </Badge>
          </div>
        </div>

        <p className="helper-text setting-note">
          {isOnline
            ? t('settings.onlineNote')
            : t('settings.offlineNote')}
          {isOnline ? <Wifi size={13} className="setting-note-icon" /> : <WifiOff size={13} className="setting-note-icon" />}
        </p>
      </Section>

      <Section title={t('settings.display')}>
        <SettingRow label={t('settings.units')} description={t('settings.unitsDescription')}>
          <SegmentedControl
            label={t('settings.units')}
            value={preferences.unitSystem}
            options={UNIT_OPTIONS}
            onChange={(value) => setPreference('unitSystem', value)}
          />
        </SettingRow>

        <SettingRow label={t('settings.language')} description={t('settings.languageDescription')}>
          <Select
            className="setting-select"
            aria-label={t('settings.language')}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((id) => (
              <option key={id} value={id}>
                {t(`language.${id}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </SettingRow>

        <SettingRow
          label={t('settings.quickLogRows')}
          description={t('settings.quickLogRowsDescription')}
        >
          <Select
            className="setting-select"
            aria-label={t('settings.quickLogRows')}
            value={preferences.quickLogRows}
            onChange={(e) => setPreference('quickLogRows', Number(e.target.value))}
          >
            {QUICK_LOG_ROW_OPTIONS.map((rows) => (
              <option key={rows} value={rows}>
                {rows === 0
                  ? t('settings.quickLogRowsAll')
                  : t('settings.quickLogRowsValue', { count: rows })}
              </option>
            ))}
          </Select>
        </SettingRow>
      </Section>

      <Section title={t('settings.map')}>
        <SettingRow
          label={t('settings.baseLayer')}
          description={t(`layer.${preferences.baseLayer}.description` as TranslationKey)}
        >
          <Select
            className="setting-select"
            aria-label={t('settings.baseLayer')}
            value={preferences.baseLayer}
            onChange={(e) => setPreference('baseLayer', e.target.value as BaseLayerId)}
          >
            {BASE_LAYER_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`layer.${id}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </SettingRow>

        {OVERLAY_IDS.map((id) => (
          <SettingRow
            key={id}
            label={t(`layer.${id}` as TranslationKey)}
            description={t(`layer.${id}.description` as TranslationKey)}
          >
            <Toggle
              label={t('layer.showOnMap', { label: t(`layer.${id}` as TranslationKey) })}
              checked={preferences.overlays[id]}
              onChange={(value) =>
                setPreference('overlays', { ...preferences.overlays, [id]: value })
              }
            />
          </SettingRow>
        ))}

        <p className="helper-text setting-note">
          {t('settings.layerNote')}
        </p>
      </Section>

      <Section title={t('settings.recording')}>
        <SettingRow
          label={t('settings.trackPoints')}
          description={t('settings.trackPointsDescription')}
        >
          <Select
            className="setting-select"
            aria-label={t('settings.trackPoints')}
            value={preferences.trackIntervalMs}
            onChange={(e) => setPreference('trackIntervalMs', Number(e.target.value))}
          >
            {TRACK_INTERVALS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </Select>
        </SettingRow>

        <SettingRow
          label={t('settings.keepScreenAwake')}
          description={t('settings.keepScreenAwakeDescription')}
        >
          <Toggle
            label={t('settings.keepScreenAwakeToggle')}
            checked={preferences.keepScreenAwake}
            onChange={(value) => setPreference('keepScreenAwake', value)}
          />
        </SettingRow>
      </Section>

      <Section title={t('settings.management')}>
        <div className="settings-list">
          <SettingLink
            to="/settings/crew"
            icon={<Users size={18} strokeWidth={1.75} />}
            label={t('crew.title')}
            value={t('settings.crewCount', { count: users.length })}
          />
          <SettingLink
            to="/settings/quicklogs"
            icon={<ListChecks size={18} strokeWidth={1.75} />}
            label={t('quickLogs.title')}
            value={t('settings.quickLogCount', { count: quickLogs.length })}
          />
        </div>
      </Section>

      <Section title={t('settings.data')}>
        <div className="settings-list">
          <SettingLink
            to="/settings/export"
            icon={<Download size={18} strokeWidth={1.75} />}
            label={t('settings.export')}
            value={t('settings.exportValue')}
          />
          <SettingLink
            to="/settings/papierkorb"
            icon={<Trash2 size={18} strokeWidth={1.75} />}
            label={t('settings.trash')}
            value={t('settings.trashValue')}
          />
        </div>
      </Section>

      <Section title={t('settings.legal')}>
        <div className="settings-list">
          <SettingLink
            to="/datenschutz"
            icon={<ShieldCheck size={18} strokeWidth={1.75} />}
            label={t('settings.privacy')}
            value={t('settings.privacyValue')}
          />
        </div>
      </Section>

      <Section title={t('settings.app')}>
        <SettingRow label={t('settings.version')} description="2cars2georgia">
          <span className="mono-num helper-text">{__APP_VERSION__}</span>
        </SettingRow>
        <div className="stack">
          <Button variant="secondary" fullWidth onClick={handleLeaveRoadtrip}>
            <DoorOpen size={18} /> {t('settings.leaveRoadtrip')}
          </Button>
          <Button variant="destructive" fullWidth disabled={signingOut} onClick={handleSignOut}>
            <LogOut size={18} /> {t('settings.logout')}
          </Button>
        </div>
      </Section>

      {canDeleteRoadtrip && (
        <Section title={t('trip.deleteTitle')}>
          <p className="helper-text">{t('trip.deleteHint')}</p>
          <Button variant="destructive" fullWidth onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={18} /> {t('trip.deleteButton')}
          </Button>
        </Section>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={t('trip.deleteConfirmTitle', { tripName: tripName ?? '' })}
        description={t('trip.deleteConfirmDescription')}
        confirmLabel={deleting ? t('trip.deleteInProgress') : t('common.delete')}
        destructive
        onConfirm={handleDeleteRoadtrip}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
