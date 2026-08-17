import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Gauge, Map as MapIcon, BookOpen, Wallet, Users, Compass } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ToastProvider } from './components/ui';
import Dashboard from './Dashboard';
import MapTab from './MapTab';
import Stats from './Stats';
import Costs from './Costs';
import Settings from './Settings';

export default function App() {
  const [user, setUser] = useState<string>('');
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('boat_user');
    if (storedUser) setUser(storedUser);

    // Dynamische Nutzerliste aus Firebase laden
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setUsers(docSnap.data().users || []);
      } else {
        // Falls noch keine Datenbank existiert, Standardwerte setzen
        const defaultUsers = ['Lukas', 'Leon', 'Niklas', 'Elias'];
        setDoc(docRef, { users: defaultUsers });
        setUsers(defaultUsers);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (name: string) => {
    localStorage.setItem('boat_user', name);
    setUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('boat_user');
    setIsTracking(false);
    setUser('');
  };

  if (loading) {
    return (
      <div className="boot-screen">
        <Compass size={28} className="boot-screen-icon" />
        <p className="helper-text">Verbinde mit Server …</p>
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <div className="login-screen">
          <div className="login-screen-head">
            <Compass size={26} />
            <h1 className="page-title">Wer ist an Bord?</h1>
            <p className="helper-text">Gerät einem Crewmitglied zuordnen, um Position und Logs zu erfassen.</p>
          </div>
          <div className="login-screen-list">
            {users.map((name) => (
              <button key={name} className="login-user" onClick={() => login(name)}>
                <span className="login-user-avatar">{name.charAt(0).toUpperCase()}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} isTracking={isTracking} setIsTracking={setIsTracking} />} />
            <Route path="/map" element={<MapTab user={user} isTracking={isTracking} />} />
            <Route path="/stats" element={<Stats user={user} />} />
            <Route path="/costs" element={<Costs user={user} users={users} />} />
            <Route path="/settings" element={<Settings currentUser={user} users={users} onLogout={handleLogout} />} />
          </Routes>
        </div>
        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Gauge size={20} strokeWidth={2} />
            <span>Cockpit</span>
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MapIcon size={20} strokeWidth={2} />
            <span>Karte</span>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={20} strokeWidth={2} />
            <span>Logbuch</span>
          </NavLink>
          <NavLink to="/costs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={20} strokeWidth={2} />
            <span>Kasse</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} strokeWidth={2} />
            <span>Crew</span>
          </NavLink>
        </nav>
      </BrowserRouter>
    </ToastProvider>
  );
}
