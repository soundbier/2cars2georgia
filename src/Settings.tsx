import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserPlus, Trash2, LogOut } from 'lucide-react';
import { db } from './firebase';
import { Button, IconButton, Input, Section, ListItem, PageHeader, ConfirmDialog, useToast } from './components/ui';

interface Props {
  currentUser: string;
  users: string[];
  onLogout: () => void;
}

export default function Settings({ currentUser, users, onLogout }: Props) {
  const [newUser, setNewUser] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const { notify } = useToast();

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUser.trim();
    if (!name) return;

    const docRef = doc(db, 'settings', 'general');
    await updateDoc(docRef, {
      users: arrayUnion(name)
    });
    setNewUser('');
  };

  const confirmRemoveUser = async () => {
    if (!pendingRemoval) return;
    const docRef = doc(db, 'settings', 'general');
    await updateDoc(docRef, {
      users: arrayRemove(pendingRemoval)
    });
    notify(`${pendingRemoval} entfernt`, 'success');
    setPendingRemoval(null);
  };

  const handleRemoveClick = (name: string) => {
    if (name === currentUser) {
      notify('Du kannst dich nicht selbst löschen.', 'danger');
      return;
    }
    setPendingRemoval(name);
  };

  return (
    <div>
      <PageHeader title="Crew" subtitle="Nutzer dieses Geräts und der Reise verwalten" />

      <Section title="Besatzung">
        <form onSubmit={handleAddUser} className="row" style={{ marginBottom: 'var(--space-3)' }}>
          <Input placeholder="Neuer Name" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
          <IconButton type="submit" label="Crewmitglied hinzufügen" tone="accent" disabled={!newUser.trim()}>
            <UserPlus size={20} />
          </IconButton>
        </form>

        <div className="stack" style={{ gap: 0 }}>
          {users.map((u) => (
            <ListItem
              key={u}
              title={
                <span style={{ color: u === currentUser ? 'var(--color-accent)' : undefined }}>
                  {u} {u === currentUser && '(Du)'}
                </span>
              }
              trailing={
                <IconButton
                  label={`${u} entfernen`}
                  tone="danger"
                  onClick={() => handleRemoveClick(u)}
                  disabled={u === currentUser}
                >
                  <Trash2 size={17} />
                </IconButton>
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Gerät">
        <Button variant="destructive" fullWidth onClick={onLogout}>
          <LogOut size={18} /> Profil abmelden
        </Button>
      </Section>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Crewmitglied entfernen"
        description={`${pendingRemoval} wird aus der Crew-Liste gelöscht. Bereits erfasste Logs und Ausgaben bleiben erhalten.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemoveUser}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
