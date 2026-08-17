import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserPlus, Trash2, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { db } from './firebase';

interface Props {
  currentUser: string;
  users: string[];
  onLogout: () => void;
}

export default function Settings({ currentUser, users, onLogout }: Props) {
  const [newUser, setNewUser] = useState('');

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.trim()) return;
    
    const docRef = doc(db, 'settings', 'general');
    await updateDoc(docRef, {
      users: arrayUnion(newUser.trim())
    });
    setNewUser('');
  };

  const handleRemoveUser = async (nameToRemove: string) => {
    if (nameToRemove === currentUser) {
      alert('Du kannst dich nicht selbst löschen!');
      return;
    }
    if (window.confirm(`${nameToRemove} wirklich aus der Crew löschen?`)) {
      const docRef = doc(db, 'settings', 'general');
      await updateDoc(docRef, {
        users: arrayRemove(nameToRemove)
      });
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid var(--surface-border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <SettingsIcon size={28} color="var(--primary)" />
        <h2 style={{ margin: 0 }}>Einstellungen</h2>
      </div>
      
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Crew verwalten</h3>
        
        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input 
            style={inputStyle}
            placeholder="Neuer Name" 
            value={newUser} 
            onChange={(e) => setNewUser(e.target.value)} 
          />
          <button type="submit" className="btn" style={{ padding: '0 16px' }} disabled={!newUser.trim()}>
            <UserPlus size={20} />
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map((u) => (
            <div key={u} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
              <span style={{ fontWeight: u === currentUser ? 'bold' : 'normal', color: u === currentUser ? 'var(--primary)' : 'var(--text)' }}>
                {u} {u === currentUser && '(Du)'}
              </span>
              <button 
                onClick={() => handleRemoveUser(u)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: u === currentUser ? 0.3 : 1 }}
                disabled={u === currentUser}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Gerät</h3>
        <button onClick={onLogout} className="btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          <LogOut size={20} /> Profil abmelden
        </button>
      </div>
    </div>
  );
}
