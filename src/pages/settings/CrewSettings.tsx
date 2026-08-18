import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { UserPlus, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { trackWrite } from '../../lib/pendingWrites';
import { getUserColor } from '../../lib/userColors';
import { IconButton, Input, Section, ListItem, PageHeader, ConfirmDialog, useToast } from '../../components/ui';
import '../Settings.css';

interface Props {
  currentUser: string;
  users: string[];
}

export default function CrewSettings({ currentUser, users }: Props) {
  const { tripId } = useRoadtrip();
  const [newUser, setNewUser] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const { notify } = useToast();

  const saveCrew = (change: FieldValue) => {
    if (!tripId) return Promise.resolve();
    return trackWrite(updateDoc(doc(db, tripPath(tripId, 'settings', 'general')), { users: change }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUser.trim();
    if (!name) return;
    if (users.some((u) => u.toLowerCase() === name.toLowerCase())) {
      notify(`${name} ist bereits an Bord.`, 'danger');
      return;
    }
    try {
      await saveCrew(arrayUnion(name));
      setNewUser('');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    }
  };

  const handleRemoveClick = (name: string) => {
    if (name === currentUser) {
      notify('Du kannst dich nicht selbst löschen.', 'danger');
      return;
    }
    setPendingRemoval(name);
  };

  const confirmRemoveUser = async () => {
    if (!pendingRemoval) return;
    try {
      await saveCrew(arrayRemove(pendingRemoval));
      notify(`${pendingRemoval} entfernt`, 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Löschen.', 'danger');
    }
    setPendingRemoval(null);
  };

  return (
    <div className="settings-page">
      <PageHeader
        title="Crew"
        subtitle="Wer an Bord ist und Logs erfassen kann"
        backTo="/settings"
        backLabel="Einstellungen"
      />

      <Section title={`Besatzung (${users.length})`}>
        <form onSubmit={handleAddUser} className="row settings-add-form">
          <Input placeholder="Neuer Name" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
          <IconButton type="submit" label="Crewmitglied hinzufügen" tone="accent" disabled={!newUser.trim()}>
            <UserPlus size={20} />
          </IconButton>
        </form>

        <div className="settings-list">
          {users.map((name) => (
            <ListItem
              key={name}
              leading={
                <span className="avatar" style={{ background: getUserColor(name), color: '#ffffff' }}>
                  {name.charAt(0).toUpperCase()}
                </span>
              }
              title={name === currentUser ? <span className="settings-list-self">{name} (Du)</span> : name}
              trailing={
                <IconButton
                  label={`${name} entfernen`}
                  tone="danger"
                  onClick={() => handleRemoveClick(name)}
                  disabled={name === currentUser}
                >
                  <Trash2 size={17} />
                </IconButton>
              }
            />
          ))}
        </div>
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
