import { useState } from 'react';
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
import { TrackingProvider } from './hooks/useTracking';
import { PreferencesProvider } from './hooks/usePreferences';
import { useCrew } from './hooks/useSettings';
import Dashboard from './pages/Dashboard';
import MapTab from './pages/MapTab';
import Stats from './pages/Stats';
import Costs from './pages/Costs';
import Settings from './pages/Settings';
import CrewSettings from './pages/settings/CrewSettings';
import QuickLogSettings from './pages/settings/QuickLogSettings';

const STORAGE_KEY_USER = 'boat_user';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Cockpit', icon: Gauge },
  { to: '/map', label: 'Karte', icon: MapIcon },
  { to: '/stats', label: 'Logbuch', icon: BookOpen },
  { to: '/costs', label: 'Kasse', icon: Wallet },
  { to: '/settings', label: 'Mehr', icon: SettingsIcon }
];

export default function App() {
  const [user, setUser] = useState<string>(() => localStorage.getItem(STORAGE_KEY_USER) ?? '');
  const { users, loading } = useCrew();

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
  if (loading && !user) {
    return (
      <div className="boot-screen">
        <Compass size={28} className="boot-screen-icon" />
        <p className="helper-text">Verbinde mit Server …</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-screen-head">
          <Compass size={26} />
          <h1 className="page-title">Wer ist an Bord?</h1>
          <p className="helper-text">Gerät einem Crewmitglied zuordnen, um Position und Logs zu erfassen.</p>
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
    <ToastProvider>
      <PreferencesProvider>
        {/* Ein Wechsel des Nutzers setzt Tracking-Status und Watcher zurück. */}
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
              </Routes>
            </div>
            <nav className="bottom-nav">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </BrowserRouter>
        </TrackingProvider>
      </PreferencesProvider>
    </ToastProvider>
  );
}
