import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Gauge,
  Map as MapIcon,
  BookOpen,
  Wallet,
  Settings as SettingsIcon,
  UtensilsCrossed,
  MoreHorizontal,
  Compass,
  LucideIcon
} from 'lucide-react';
import { Button, Input, ToastProvider, useToast } from './components/ui';
import { I18nProvider, useT, TranslationKey } from './i18n';
import { TrackingProvider } from './hooks/useTracking';
import { PreferencesProvider } from './hooks/usePreferences';
import { RoadtripProvider, useRoadtrip } from './hooks/useRoadtrip';
import { setSentryContext } from './lib/sentry';
import { MAX_CREW_NAME_LENGTH, addCrewMember, isCrewNameTaken, normalizeCrewName } from './lib/crew';
import { setErrorLogContext } from './lib/errorLog';
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
import Verpflegung from './pages/kombuese/Verpflegung';
import MealPlan from './pages/kombuese/MealPlan';
import Dishes from './pages/kombuese/Dishes';
import ShoppingList from './pages/kombuese/ShoppingList';
import Inventory from './pages/kombuese/Inventory';
import Privacy from './pages/Privacy';

const STORAGE_KEY_USER = 'boat_user';

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { to: '/', labelKey: 'nav.cockpit', icon: Gauge },
  { to: '/map', labelKey: 'nav.map', icon: MapIcon },
  { to: '/stats', labelKey: 'nav.logbook', icon: BookOpen },
  { to: '/costs', labelKey: 'nav.costs', icon: Wallet }
];

/** Ziele des "Mehr"-Dropups, siehe Bottom-Navigation weiter unten. */
const MORE_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { to: '/settings/verpflegung', labelKey: 'kombuese.sectionTitle', icon: UtensilsCrossed },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon }
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
  const [newName, setNewName] = useState('');
  const [joining, setJoining] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { notify } = useToast();
  const t = useT();

  // Ordnet Fehlerberichte (siehe main.tsx/lib/sentry.ts) dem Roadtrip und
  // Crewmitglied zu, ohne echte personenbezogene Daten zu senden – tripId
  // ist bereits ein anonymer Slug, kein Klarname oder Kontaktdaten.
  useEffect(() => {
    setSentryContext(tripId, user || null);
    setErrorLogContext(tripId, user || null);
  }, [tripId, user]);

  const login = (name: string) => {
    localStorage.setItem(STORAGE_KEY_USER, name);
    setUser(name);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    setUser('');
  };

  /**
   * Beitritt ohne Umweg über ein anderes Gerät: Wer den Roadtrip-Zugang hat,
   * trägt sich hier selbst als Crewmitglied ein. Der Owner kann die Liste
   * später jederzeit in den Einstellungen korrigieren.
   */
  const joinCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = normalizeCrewName(newName);
    if (!name || !tripId) return;
    if (isCrewNameTaken(users, name)) {
      notify(t('crewGate.nameTaken', { name }), 'danger');
      return;
    }
    setJoining(true);
    try {
      await addCrewMember(tripId, name);
      login(name);
    } catch (err) {
      console.error(err);
      notify(t('crewGate.joinFailed'), 'danger');
    } finally {
      setJoining(false);
    }
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
          <p className="helper-text">
            {users.length === 0 ? t('crewGate.firstMemberHint') : t('crewGate.hint')}
          </p>
        </div>
        {users.length > 0 && (
          <div className="login-screen-list">
            {users.map((name) => (
              <button key={name} className="login-user" onClick={() => login(name)}>
                <span className="avatar">{name.charAt(0).toUpperCase()}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        )}
        <form className="login-join" onSubmit={joinCrew}>
          <label className="label" htmlFor="crew-join-name">
            {users.length === 0 ? t('crewGate.firstMemberLabel') : t('crewGate.newHere')}
          </label>
          <div className="row">
            <Input
              id="crew-join-name"
              placeholder={t('crewGate.namePlaceholder')}
              value={newName}
              maxLength={MAX_CREW_NAME_LENGTH}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={!normalizeCrewName(newName) || joining}>
              {t('crewGate.join')}
            </Button>
          </div>
        </form>
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
            <Route path="/stats" element={<Stats user={user} />} />
            <Route path="/costs" element={<Costs user={user} users={users} />} />
            <Route
              path="/settings"
              element={<Settings currentUser={user} users={users} onLogout={logout} />}
            />
            <Route
              path="/settings/crew"
              element={<CrewSettings currentUser={user} users={users} />}
            />
            <Route path="/settings/quicklogs" element={<QuickLogSettings currentUser={user} />} />
            <Route path="/settings/export" element={<ExportSettings users={users} />} />
            <Route path="/settings/papierkorb" element={<TrashSettings currentUser={user} />} />
            <Route path="/settings/verpflegung" element={<Verpflegung />} />
            <Route path="/settings/verpflegung/speiseplan" element={<MealPlan currentUser={user} />} />
            <Route path="/settings/verpflegung/gerichte" element={<Dishes currentUser={user} />} />
            <Route
              path="/settings/verpflegung/einkaufsliste"
              element={<ShoppingList currentUser={user} />}
            />
            <Route path="/settings/verpflegung/lager" element={<Inventory currentUser={user} />} />
            <Route path="/datenschutz" element={<Privacy />} />
          </Routes>
        </div>
        {moreOpen && (
          <div className="more-backdrop" onClick={() => setMoreOpen(false)} />
        )}
        {moreOpen && (
          <div className="more-dropup">
            {MORE_ITEMS.map(({ to, labelKey, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/settings'}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) => `more-dropup-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} strokeWidth={2} />
                <span>{t(labelKey)}</span>
              </NavLink>
            ))}
          </div>
        )}
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
          <button
            type="button"
            className={`nav-item ${moreOpen ? 'active' : ''}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreHorizontal size={20} strokeWidth={2} />
            <span>{t('nav.more')}</span>
          </button>
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
