import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { db } from '../../firebase';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { trackWrite } from '../../lib/pendingWrites';
import { useQuickLogs } from '../../hooks/useSettings';
import { QUICK_LOG_ICONS, DEFAULT_QUICK_LOG_ICON, getQuickLogIcon } from '../../lib/quickLogIcons';
import { QuickLogConfig, QuickLogIconName } from '../../types';
import {
  IconButton,
  Input,
  Section,
  ListItem,
  EmptyState,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';

const ICON_NAMES = Object.keys(QUICK_LOG_ICONS) as QuickLogIconName[];

function createQuickLogId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface IconPickerProps {
  value: QuickLogIconName;
  onChange: (value: QuickLogIconName) => void;
}

function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label="Symbol wählen">
      {ICON_NAMES.map((name) => {
        const Icon = QUICK_LOG_ICONS[name];
        const isActive = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Symbol ${name}`}
            className={`icon-picker-option ${isActive ? 'icon-picker-option-active' : ''}`}
            onClick={() => onChange(name)}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

export default function QuickLogSettings() {
  const { tripId } = useRoadtrip();
  const quickLogs = useQuickLogs();
  const { notify } = useToast();

  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState<QuickLogIconName>(DEFAULT_QUICK_LOG_ICON);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingIcon, setEditingIcon] = useState<QuickLogIconName>(DEFAULT_QUICK_LOG_ICON);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const saveQuickLogs = async (items: QuickLogConfig[], errorMessage = 'Fehler beim Speichern.') => {
    if (!tripId) return false;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'settings', 'quicklogs')), { items }));
      return true;
    } catch (err) {
      console.error(err);
      notify(errorMessage, 'danger');
      return false;
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;

    const item: QuickLogConfig = { id: createQuickLogId(), label, iconName: newIcon };
    if (await saveQuickLogs([...quickLogs, item])) {
      setNewLabel('');
      setNewIcon(DEFAULT_QUICK_LOG_ICON);
    }
  };

  const startEditing = (log: QuickLogConfig) => {
    setEditingId(log.id);
    setEditingLabel(log.label);
    setEditingIcon(log.iconName);
  };

  const handleSaveEdit = async () => {
    const label = editingLabel.trim();
    if (!editingId || !label) return;

    const items = quickLogs.map((q) =>
      q.id === editingId ? { ...q, label, iconName: editingIcon } : q
    );
    if (await saveQuickLogs(items)) setEditingId(null);
  };

  const confirmRemove = async () => {
    if (!pendingRemoval) return;
    const items = quickLogs.filter((q) => q.id !== pendingRemoval);
    if (await saveQuickLogs(items, 'Fehler beim Löschen.')) notify('Schnell-Log entfernt', 'success');
    setPendingRemoval(null);
  };

  const pendingLabel = quickLogs.find((q) => q.id === pendingRemoval)?.label;

  return (
    <div className="settings-page">
      <PageHeader
        title="Schnell-Logs"
        subtitle="Kategorien für die Ereignis-Buttons im Cockpit"
        backTo="/settings"
        backLabel="Einstellungen"
      />

      <Section title="Neue Kategorie">
        <form onSubmit={handleAdd} className="stack">
          <Input
            placeholder="Bezeichnung, z. B. Wasser tanken"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <IconPicker value={newIcon} onChange={setNewIcon} />
          <div className="row">
            <IconButton type="submit" label="Kategorie hinzufügen" tone="accent" disabled={!newLabel.trim()}>
              <Plus size={20} />
            </IconButton>
            <span className="helper-text">Symbol und Bezeichnung erscheinen im Cockpit und im Logbuch.</span>
          </div>
        </form>
      </Section>

      <Section title={`Kategorien (${quickLogs.length})`}>
        {quickLogs.length === 0 ? (
          <EmptyState title="Keine Schnell-Logs" hint="Füge oben die erste Kategorie hinzu." />
        ) : (
          <div className="settings-list">
            {quickLogs.map((log) => {
              const Icon = getQuickLogIcon(log.iconName);
              const isEditing = editingId === log.id;

              if (isEditing) {
                return (
                  <div key={log.id} className="stack quicklog-edit">
                    <Input
                      autoFocus
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <IconPicker value={editingIcon} onChange={setEditingIcon} />
                    <div className="row">
                      <IconButton
                        label="Änderung speichern"
                        tone="accent"
                        onClick={handleSaveEdit}
                        disabled={!editingLabel.trim()}
                      >
                        <Check size={18} />
                      </IconButton>
                      <IconButton label="Abbrechen" onClick={() => setEditingId(null)}>
                        <X size={18} />
                      </IconButton>
                    </div>
                  </div>
                );
              }

              return (
                <ListItem
                  key={log.id}
                  leading={<Icon size={18} strokeWidth={1.75} color="var(--color-accent)" />}
                  title={log.label}
                  trailing={
                    <>
                      <IconButton label={`${log.label} bearbeiten`} onClick={() => startEditing(log)}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        label={`${log.label} löschen`}
                        tone="danger"
                        onClick={() => setPendingRemoval(log.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Schnell-Log entfernen"
        description={`„${pendingLabel}“ wird aus den Schnell-Logs entfernt. Bereits erfasste Ereignisse bleiben erhalten.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
