import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Navigation, Map as MapIcon, BarChart2, DollarSign } from 'lucide-react';
import Dashboard from './Dashboard';
import MapTab from './MapTab';
import Stats from './Stats';
import Costs from './Costs';
import { APP_USERS } from './types';

export default function App() {
  const [user, setUser] = useState<string>('');
  const [isTracking, setIsTracking] = useState<boolean>(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('boat_user');
    if (storedUser) setUser(storedUser);
  }, []);

  const login = (name: string) => {
    localStorage.setItem('boat_user', name);
    setUser(name);
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', marginTop: '20vh' }}>
        <h2 style={{ marginBottom: '20px' }}>Wer nutzt dieses Gerät?</h2>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {APP_USERS.map((name) => (
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
          <Route path="/costs" element={<Costs user={user} />} />
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
      </nav>
    </BrowserRouter>
  );
}
