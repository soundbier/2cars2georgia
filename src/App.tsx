import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Navigation, Map as MapIcon, BarChart2, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', marginTop: '20vh' }}>Verbinde mit Server...</div>;

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', marginTop: '20vh' }}>
        <h2 style={{ marginBottom: '20px' }}>Wer nutzt dieses Gerät?</h2>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {users.map((name) => (
            <button key={name} className="btn" onClick={() => login(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
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
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Navigation size={22} />
          <span>Dash</span>
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <MapIcon size={22} />
          <span>Karte</span>
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <BarChart2 size={22} />
          <span>Stats</span>
        </NavLink>
        <NavLink to="/costs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <DollarSign size={22} />
          <span>Kosten</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <SettingsIcon size={22} />
          <span>Setup</span>
        </NavLink>
      </nav>
    </BrowserRouter>
  );
}
