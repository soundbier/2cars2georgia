import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Gauge,
  Map as MapIcon,
  BookOpen,
  Wallet,
  Settings as SettingsIcon,
  Compass,
  LucideIcon
} from 'lucide-react';
import { ToastProvider } from './components/ui';
import { I18nProvider, useT, TranslationKey } from './i18n';
import { TrackingProvider } from './hooks/useTracking';
import { PreferencesProvider } from './hooks/usePreferences';
import { RoadtripProvider, useRoadtrip } from './hooks/useRoadtrip';
import { setSentryContext } from './lib/sentry';
import { useCrew } from './hooks/useSettings';
import { UpdatePrompt } from './UpdatePrompt';
import { RecoveryCodeDialog } from './components/RecoveryCodeDialog';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import RoadtripGate from './pages/RoadtripGate';
import Dashboard from './pages/Dashboard';
import MapTab from './pages/MapTab';
import Stats from './pages/Stats';
import Costs from './pages/Costs';
import Settings from './pages/Settings';
import CrewSettings from './pages/settings/CrewSettings';
import QuickLogSettings from './pages/settings/QuickLogSettings';
import ExportSettings from './pages/settings/ExportSettings';
import TrashSettings from './pages/settings/TrashSettings';
import Privacy from './pages/Privacy';

const STORAGE_KEY_USER = 'boat_user';

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { to: '/', labelKey: 'nav.cockpit', icon: Gauge },
  { to: '/map', labelKey: 'nav.map', icon: MapIcon },
  { to: '/stats', labelKey: 'nav.logbook', icon: BookOpen },
  { to: '/costs', labelKey: 'nav.costs', icon: Wallet },
  { to: '/settings', labelKey: 'nav.more', icon: SettingsIcon }
];

/**
 * Crew-Anmeldung innerhalb eines bereits authentifizierten Roadtrips: Ordnet
 * das Gerät einem der Crew-Namen zu. Der eigentliche Zugriffsschutz sitzt
 * eine Ebene höher in RoadtripGate/RoadtripProvider – hier geht es nur noch
 * um "wer bist du innerhalb der Crew", nicht "darfst du überhaupt rein".
 */
function CrewGate() {
  const { tripId } = useRoadtrip();
  const [user, setUser] = useState<string>(() => localStorage.getItem(STORAGE_KEY_USER) ?? '');
  const { users, loading } = useCrew();
  const t = useT();

  // Ordnet Fehlerberichte (siehe main.tsx/lib/sentry.ts) dem Roadtrip und
  // Crewmitglied zu, ohne echte personenbezogene Daten zu senden – tripId
  // ist bereits ein anonymer Slug, kein Klarname oder Kontaktdaten.
  useEffect(() => {
    setSentryContext(tripId, user || null);
  }, [tripId, user]);

  const login = (name: string) => {
    localStorage.setItem(STORAGE_KEY_USER, name);
    setUser(name);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    setUser('');
  };

  // Nur der Login-Screen braucht die Crew-Liste. Wer bereits angemeldet ist,
  // startet sofort – die App ist offline-fähig und darf nicht auf Firestore warten.
  const bootstrapping = loading && !user;

  if (bootstrapping) {
    return (
      <div className="boot-screen">
        <Compass size={28} className="boot-screen-icon" />
        <p className="helper-text">{t('common.connecting')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-screen-head">
          <Compass size={26} />
          <h1 className="page-title">{t('crewGate.title')}</h1>
          <p className="helper-text">{t('crewGate.hint')}</p>
        </div>
        <div className="login-screen-list">
          {users.map((name) => (
            <button key={name} className="login-user" onClick={() => login(name)}>
              <span className="avatar">{name.charAt(0).toUpperCase()}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    // Ein Wechsel des Nutzers setzt Tracking-Status und Watcher zurück.
    <TrackingProvider key={user} user={user}>
      <BrowserRouter>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/map" element={<MapTab user={user} />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/costs" element={<Costs user={user} users={users} />} />
            <Route
              path="/settings"
              element={<Settings currentUser={user} users={users} onLogout={logout} />}
            />
            <Route
              path="/settings/crew"
              element={<CrewSettings currentUser={user} users={users} />}
            />
            <Route path="/settings/quicklogs" element={<QuickLogSettings />} />
            <Route path="/settings/export" element={<ExportSettings users={users} />} />
            <Route path="/settings/papierkorb" element={<TrashSettings />} />
            <Route path="/datenschutz" element={<Privacy />} />
          </Routes>
        </div>
        <nav className="bottom-nav">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <SyncStatusBanner />
      </BrowserRouter>
    </TrackingProvider>
  );
}

/** Blendet zwischen dem Roadtrip-Gate und der eigentlichen App um. */
function RoadtripGateOrApp({
  onRoadtripCreated
}: {
  onRoadtripCreated: (tripName: string, recoveryCode: string) => void;
}) {
  const { loading, tripId } = useRoadtrip();
  const t = useT();

  if (loading) {
    return (
      <div className="boot-screen">
        <Compass size={28} className="boot-screen-icon" />
        <p className="helper-text">{t('common.connecting')}</p>
      </div>
    );
  }

  // key={tripId} erzwingt einen frischen CrewGate-Baum bei Roadtrip-Wechsel,
  // damit kein Zustand (z.B. ein Crew-Name) aus dem vorigen Trip übrig bleibt.
  return tripId ? (
    <CrewGate key={tripId} />
  ) : (
    <RoadtripGate onRoadtripCreated={onRoadtripCreated} />
  );
}

export default function App() {
  // Lebt bewusst hier oben, nicht in RoadtripGate: Sobald createRoadtrip
  // erfolgreich ist, wechselt der Auth-Status und RoadtripGateOrApp blendet
  // auf CrewGate um – RoadtripGate selbst wäre dann schon unmontiert und
  // könnte den Dialog nicht mehr zeigen.
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<{
    tripName: string;
    code: string;
  } | null>(null);

  return (
    /* Sprache und Geräteeinstellungen liegen ganz außen: Auch das
       Roadtrip-Gate und der Update-Screen erscheinen schon übersetzt, lange
       bevor jemand angemeldet ist. */
    <PreferencesProvider>
      <I18nProvider>
        <ToastProvider>
          {/* App-weit gemountet, unabhängig vom Anmeldestatus: Ein Deploy soll auch
              erreichen, wer gerade erst das Roadtrip-Gate sieht. */}
          <UpdatePrompt />
          <RoadtripProvider>
            <RoadtripGateOrApp
              onRoadtripCreated={(tripName, code) => setPendingRecoveryCode({ tripName, code })}
            />
          </RoadtripProvider>
          {pendingRecoveryCode && (
            <RecoveryCodeDialog
              tripName={pendingRecoveryCode.tripName}
              code={pendingRecoveryCode.code}
              onAcknowledge={() => setPendingRecoveryCode(null)}
            />
          )}
        </ToastProvider>
      </I18nProvider>
    </PreferencesProvider>
  );
}
