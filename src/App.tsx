import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Gauge,
  Map as MapIcon,
  BookOpen,
  Wallet,
  Settings as SettingsIcon,
  UtensilsCrossed,
  Route as RouteIcon,
  MoreHorizontal,
  ShieldCheck,
  Compass,
  LucideIcon
} from 'lucide-react';
import { ToastProvider } from './components/ui';
import { I18nProvider, useT, TranslationKey } from './i18n';
import { TrackingProvider } from './hooks/useTracking';
import { PreferencesProvider } from './hooks/usePreferences';
import { RoadtripProvider, useRoadtrip } from './hooks/useRoadtrip';
import { setSentryContext } from './lib/sentry';
import { setErrorLogContext } from './lib/errorLog';
import { useCrew } from './hooks/useSettings';
import { UpdatePrompt } from './UpdatePrompt';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import AuthGate from './pages/AuthGate';
import ProfileGate from './pages/ProfileGate';
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
import RoutePlanner from './pages/RoutePlanner';
import Verpflegung from './pages/kombuese/Verpflegung';
import MealPlan from './pages/kombuese/MealPlan';
import Dishes from './pages/kombuese/Dishes';
import ShoppingList from './pages/kombuese/ShoppingList';
import Inventory from './pages/kombuese/Inventory';
import Administration from './pages/Administration';
import Privacy from './pages/Privacy';
import PrivacyOnboarding from './pages/PrivacyOnboarding';

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { to: '/', labelKey: 'nav.cockpit', icon: Gauge },
  { to: '/map', labelKey: 'nav.map', icon: MapIcon },
  { to: '/stats', labelKey: 'nav.logbook', icon: BookOpen },
  { to: '/costs', labelKey: 'nav.costs', icon: Wallet }
];

/** Ziele des "Mehr"-Dropups, siehe Bottom-Navigation weiter unten. */
const MORE_ITEMS: { to: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { to: '/settings/verpflegung', labelKey: 'kombuese.sectionTitle', icon: UtensilsCrossed },
  { to: '/settings/routenplaner', labelKey: 'plan.title', icon: RouteIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon }
];

/**
 * Zusätzlicher Eintrag für Profile mit users/{uid}.role == 'admin'
 * (siehe hooks/useRoadtrip.tsx). Ausgeblendet zu sein ist nur Kosmetik –
 * lesen darf die Seite ohnehin nur, wen firestore.rules als Admin kennt.
 */
const ADMIN_MORE_ITEM: { to: string; labelKey: TranslationKey; icon: LucideIcon } = {
  to: '/administration',
  labelKey: 'nav.administration',
  icon: ShieldCheck
};

/**
 * Die eigentliche App-Oberfläche für ein bestätigtes Roadtrip-Mitglied.
 * Zugriffsschutz sitzt eine Ebene höher (RoadtripProvider/AppGate) – hier
 * geht es nur noch um Navigation und Routing.
 */
function AppShell() {
  const { tripId, displayName, authUser, isPlatformAdmin } = useRoadtrip();
  const { users } = useCrew();
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useT();
  const user = displayName ?? '';
  const moreItems = isPlatformAdmin ? [...MORE_ITEMS, ADMIN_MORE_ITEM] : MORE_ITEMS;

  // Ordnet Fehlerberichte (siehe main.tsx/lib/sentry.ts) dem Roadtrip und
  // Crewmitglied zu, ohne echte personenbezogene Daten zu senden – tripId
  // ist bereits ein anonymer Slug, kein Klarname oder Kontaktdaten.
  useEffect(() => {
    setSentryContext(tripId, user || null);
    setErrorLogContext(tripId, user || null, authUser?.uid ?? null);
  }, [tripId, user, authUser]);

  // Nur hier gibt es die Bottom-Navigation. Die Toasts richten sich daran aus
  // (siehe ui/Toast.css); auf den Gate-Seiten davor – Login, Profil,
  // Roadtrip-Wahl, Datenschutz-Onboarding – gibt es keine, und der
  // reservierte Platz ließ die Meldung mitten im Text stehen.
  useEffect(() => {
    document.body.classList.add('has-bottom-nav');
    return () => document.body.classList.remove('has-bottom-nav');
  }, []);

  return (
    <TrackingProvider key={user} user={user}>
      <BrowserRouter>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/map" element={<MapTab user={user} />} />
            <Route path="/stats" element={<Stats user={user} />} />
            <Route path="/costs" element={<Costs user={user} users={users} />} />
            <Route path="/settings" element={<Settings currentUser={user} users={users} />} />
            <Route path="/settings/crew" element={<CrewSettings />} />
            <Route path="/settings/quicklogs" element={<QuickLogSettings currentUser={user} />} />
            <Route path="/settings/export" element={<ExportSettings users={users} />} />
            <Route path="/settings/papierkorb" element={<TrashSettings currentUser={user} />} />
            <Route path="/settings/routenplaner" element={<RoutePlanner />} />
            <Route path="/settings/verpflegung" element={<Verpflegung />} />
            <Route path="/settings/verpflegung/speiseplan" element={<MealPlan currentUser={user} />} />
            <Route path="/settings/verpflegung/gerichte" element={<Dishes currentUser={user} />} />
            <Route
              path="/settings/verpflegung/einkaufsliste"
              element={<ShoppingList currentUser={user} />}
            />
            <Route path="/settings/verpflegung/lager" element={<Inventory currentUser={user} />} />
            <Route path="/administration" element={<Administration />} />
            <Route path="/datenschutz" element={<Privacy />} />
          </Routes>
        </div>
        {moreOpen && (
          <div className="more-backdrop" onClick={() => setMoreOpen(false)} />
        )}
        {moreOpen && (
          <div className="more-dropup">
            {moreItems.map(({ to, labelKey, icon: Icon }) => (
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

/**
 * Blendet zwischen den vier Stufen der App-Flow um (siehe README):
 * nicht angemeldet → Login/Registrierung, angemeldet ohne Profil →
 * Anzeigenamen festlegen, angemeldet ohne Roadtrip → erstellen/beitreten,
 * Mitglied → eigentliche App.
 */
function AppGate() {
  const { loading, authUser, displayName, tripId } = useRoadtrip();
  const t = useT();

  if (loading) {
    return (
      <div className="boot-screen">
        <Compass size={28} className="boot-screen-icon" />
        <p className="helper-text">{t('common.connecting')}</p>
      </div>
    );
  }

  if (!authUser) return <AuthGate />;
  if (!displayName) return <ProfileGate />;
  if (!tripId) return <RoadtripGate />;

  // key={tripId} erzwingt einen frischen Baum bei Roadtrip-Wechsel, damit
  // kein Zustand aus dem vorigen Trip übrig bleibt.
  return <AppShell key={tripId} />;
}

export default function App() {
  return (
    /* Sprache und Geräteeinstellungen liegen ganz außen: Auch die
       Anmeldung und der Update-Screen erscheinen schon übersetzt, lange
       bevor jemand angemeldet ist. */
    <PreferencesProvider>
      <I18nProvider>
        <ToastProvider>
          {/* App-weit gemountet, unabhängig vom Anmeldestatus: Ein Deploy soll auch
              erreichen, wer gerade erst angemeldet ist. */}
          <UpdatePrompt />
          {/* Muss vor jedem Login und vor dem ersten App-Start bestätigt werden,
              siehe PrivacyOnboarding.tsx – deshalb außerhalb von RoadtripProvider. */}
          <PrivacyOnboarding>
            <RoadtripProvider>
              <AppGate />
            </RoadtripProvider>
          </PrivacyOnboarding>
        </ToastProvider>
      </I18nProvider>
    </PreferencesProvider>
  );
}
