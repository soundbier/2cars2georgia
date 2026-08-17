import { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserPlus, Trash2, LogOut, Wifi, WifiOff, Plus, Pencil, Check, X } from 'lucide-react';
import { db } from './firebase';
import { useQuickLogs } from './useQuickLogs';
import { getQuickLogIcon, DEFAULT_QUICK_LOG_ICON } from './quickLogIcons';
import { QuickLogConfig } from './types';
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
} from './components/ui';

interface Props {
  currentUser: string;
  users: string[];
  onLogout: () => void;
}

function createQuickLogId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function Settings({ currentUser, users, onLogout }: Props) {
  const { quickLogs } = useQuickLogs();
  const { notify } = useToast();

  // --- Crew ---
  const [newUser, setNewUser] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  // --- Verbindungsstatus ---
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // --- Schnell-Logs ---
  const [newLogLabel, setNewLogLabel] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogLabel, setEditingLogLabel] = useState('');
  const [pendingLogRemoval, setPendingLogRemoval] = useState<string | null>(null);

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

  const saveQuickLogs = (items: QuickLogConfig[]) => updateDoc(doc(db, 'settings', 'quicklogs'), { items });

  const handleAddQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLogLabel.trim();
    if (!label) return;

    const newItem: QuickLogConfig = { id: createQuickLogId(), label, iconName: DEFAULT_QUICK_LOG_ICON };
    try {
      await saveQuickLogs([...quickLogs, newItem]);
      setNewLogLabel('');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    }
  };

  const startEditQuickLog = (log: QuickLogConfig) => {
    setEditingLogId(log.id);
    setEditingLogLabel(log.label);
  };

  const handleSaveQuickLogEdit = async () => {
    if (!editingLogId) return;
    const label = editingLogLabel.trim();
    if (!label) return;

    try {
      await saveQuickLogs(quickLogs.map((q) => (q.id === editingLogId ? { ...q, label } : q)));
      setEditingLogId(null);
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    }
  };

  const confirmRemoveQuickLog = async () => {
    if (!pendingLogRemoval) return;
    try {
      await saveQuickLogs(quickLogs.filter((q) => q.id !== pendingLogRemoval));
      notify('Schnell-Log entfernt', 'success');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Löschen.', 'danger');
    }
    setPendingLogRemoval(null);
  };

  const pendingLogLabel = quickLogs.find((q) => q.id === pendingLogRemoval)?.label;

  return (
    <div>
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

      <Section title="Schnell-Logs">
        <form onSubmit={handleAddQuickLog} className="row" style={{ marginBottom: 'var(--space-3)' }}>
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
          <div className="stack" style={{ gap: 0 }}>
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
        open={pendingRemoval !== null}
        title="Crewmitglied entfernen"
        description={`${pendingRemoval} wird aus der Crew-Liste gelöscht. Bereits erfasste Logs und Ausgaben bleiben erhalten.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemoveUser}
        onCancel={() => setPendingRemoval(null)}
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
