import { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { UserPlus, Trash2, LogOut, Wifi, WifiOff, Plus, Pencil, Check, X } from 'lucide-react';
import { db } from '../firebase';
import { useQuickLogs } from '../hooks/useSettings';
import { getQuickLogIcon, DEFAULT_QUICK_LOG_ICON } from '../lib/quickLogIcons';
import { QuickLogConfig } from '../types';
import {
  Button,
  IconButton,
  Input,
  Section,
  ListItem,
  Badge,
  EmptyState,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../components/ui';
import './Settings.css';

interface Props {
  currentUser: string;
  users: string[];
  onLogout: () => void;
}

function createQuickLogId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}

export default function Settings({ currentUser, users, onLogout }: Props) {
  const quickLogs = useQuickLogs();
  const { notify } = useToast();
  const isOnline = useOnlineStatus();

  // --- Crew ---
  const [newUser, setNewUser] = useState('');
  const [pendingUserRemoval, setPendingUserRemoval] = useState<string | null>(null);

  // --- Schnell-Logs ---
  const [newLogLabel, setNewLogLabel] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogLabel, setEditingLogLabel] = useState('');
  const [pendingLogRemoval, setPendingLogRemoval] = useState<string | null>(null);

  /** Kapselt Firestore-Schreibzugriffe samt einheitlicher Fehlermeldung. */
  const runWrite = async (write: () => Promise<void>, errorMessage = 'Fehler beim Speichern.') => {
    try {
      await write();
      return true;
    } catch (err) {
      console.error(err);
      notify(errorMessage, 'danger');
      return false;
    }
  };

  const saveCrew = (change: FieldValue) =>
    updateDoc(doc(db, 'settings', 'general'), { users: change });

  const saveQuickLogs = (items: QuickLogConfig[]) =>
    updateDoc(doc(db, 'settings', 'quicklogs'), { items });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUser.trim();
    if (!name) return;
    if (users.some((u) => u.toLowerCase() === name.toLowerCase())) {
      notify(`${name} ist bereits an Bord.`, 'danger');
      return;
    }
    if (await runWrite(() => saveCrew(arrayUnion(name)))) setNewUser('');
  };

  const handleRemoveUserClick = (name: string) => {
    if (name === currentUser) {
      notify('Du kannst dich nicht selbst löschen.', 'danger');
      return;
    }
    setPendingUserRemoval(name);
  };

  const confirmRemoveUser = async () => {
    if (!pendingUserRemoval) return;
    if (await runWrite(() => saveCrew(arrayRemove(pendingUserRemoval)), 'Fehler beim Löschen.')) {
      notify(`${pendingUserRemoval} entfernt`, 'success');
    }
    setPendingUserRemoval(null);
  };

  const handleAddQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLogLabel.trim();
    if (!label) return;

    const newItem: QuickLogConfig = {
      id: createQuickLogId(),
      label,
      iconName: DEFAULT_QUICK_LOG_ICON
    };
    if (await runWrite(() => saveQuickLogs([...quickLogs, newItem]))) setNewLogLabel('');
  };

  const startEditQuickLog = (log: QuickLogConfig) => {
    setEditingLogId(log.id);
    setEditingLogLabel(log.label);
  };

  const handleSaveQuickLogEdit = async () => {
    const label = editingLogLabel.trim();
    if (!editingLogId || !label) return;

    const items = quickLogs.map((q) => (q.id === editingLogId ? { ...q, label } : q));
    if (await runWrite(() => saveQuickLogs(items))) setEditingLogId(null);
  };

  const confirmRemoveQuickLog = async () => {
    if (!pendingLogRemoval) return;
    const items = quickLogs.filter((q) => q.id !== pendingLogRemoval);
    if (await runWrite(() => saveQuickLogs(items), 'Fehler beim Löschen.')) {
      notify('Schnell-Log entfernt', 'success');
    }
    setPendingLogRemoval(null);
  };

  const pendingLogLabel = quickLogs.find((q) => q.id === pendingLogRemoval)?.label;

  return (
    <div className="settings-page">
      <PageHeader title="Crew" subtitle="Nutzer, Verbindung und Schnell-Logs verwalten" />

      <Section title="Systemstatus">
        <ListItem
          leading={
            isOnline ? (
              <Wifi size={18} strokeWidth={1.75} color="var(--color-success)" />
            ) : (
              <WifiOff size={18} strokeWidth={1.75} color="var(--color-danger)" />
            )
          }
          title="Verbindung"
          subtitle={
            isOnline
              ? 'Änderungen werden sofort mit der Crew synchronisiert.'
              : 'Änderungen werden lokal gespeichert und später synchronisiert.'
          }
          trailing={
            <Badge tone={isOnline ? 'success' : 'danger'} dot>
              {isOnline ? 'Verbunden (Live-Sync aktiv)' : 'Offline (Lokaler Modus)'}
            </Badge>
          }
        />
      </Section>

      <Section title="Besatzung">
        <form onSubmit={handleAddUser} className="row settings-add-form">
          <Input placeholder="Neuer Name" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
          <IconButton type="submit" label="Crewmitglied hinzufügen" tone="accent" disabled={!newUser.trim()}>
            <UserPlus size={20} />
          </IconButton>
        </form>

        <div className="settings-list">
          {users.map((u) => (
            <ListItem
              key={u}
              title={
                u === currentUser ? <span className="settings-list-self">{u} (Du)</span> : u
              }
              trailing={
                <IconButton
                  label={`${u} entfernen`}
                  tone="danger"
                  onClick={() => handleRemoveUserClick(u)}
                  disabled={u === currentUser}
                >
                  <Trash2 size={17} />
                </IconButton>
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Schnell-Logs">
        <form onSubmit={handleAddQuickLog} className="row settings-add-form">
          <Input
            placeholder="Neue Kategorie, z. B. Wasser tanken"
            value={newLogLabel}
            onChange={(e) => setNewLogLabel(e.target.value)}
          />
          <IconButton type="submit" label="Schnell-Log hinzufügen" tone="accent" disabled={!newLogLabel.trim()}>
            <Plus size={20} />
          </IconButton>
        </form>

        {quickLogs.length === 0 ? (
          <EmptyState title="Keine Schnell-Logs" hint="Füge oben die erste Kategorie hinzu." />
        ) : (
          <div className="settings-list">
            {quickLogs.map((q) => {
              const Icon = getQuickLogIcon(q.iconName);
              const isEditing = editingLogId === q.id;
              return (
                <ListItem
                  key={q.id}
                  leading={<Icon size={18} strokeWidth={1.75} color="var(--color-accent)" />}
                  title={
                    isEditing ? (
                      <Input
                        autoFocus
                        value={editingLogLabel}
                        onChange={(e) => setEditingLogLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveQuickLogEdit();
                          if (e.key === 'Escape') setEditingLogId(null);
                        }}
                      />
                    ) : (
                      q.label
                    )
                  }
                  trailing={
                    isEditing ? (
                      <>
                        <IconButton
                          label="Umbenennen speichern"
                          tone="accent"
                          onClick={handleSaveQuickLogEdit}
                          disabled={!editingLogLabel.trim()}
                        >
                          <Check size={17} />
                        </IconButton>
                        <IconButton label="Abbrechen" onClick={() => setEditingLogId(null)}>
                          <X size={17} />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton label={`${q.label} umbenennen`} onClick={() => startEditQuickLog(q)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton
                          label={`${q.label} löschen`}
                          tone="danger"
                          onClick={() => setPendingLogRemoval(q.id)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Gerät">
        <Button variant="destructive" fullWidth onClick={onLogout}>
          <LogOut size={18} /> Profil abmelden
        </Button>
      </Section>

      <ConfirmDialog
        open={pendingUserRemoval !== null}
        title="Crewmitglied entfernen"
        description={`${pendingUserRemoval} wird aus der Crew-Liste gelöscht. Bereits erfasste Logs und Ausgaben bleiben erhalten.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemoveUser}
        onCancel={() => setPendingUserRemoval(null)}
      />

      <ConfirmDialog
        open={pendingLogRemoval !== null}
        title="Schnell-Log entfernen"
        description={`„${pendingLogLabel}“ wird aus den Schnell-Logs entfernt. Bereits erfasste Ereignisse bleiben erhalten.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemoveQuickLog}
        onCancel={() => setPendingLogRemoval(null)}
      />
    </div>
  );
}
