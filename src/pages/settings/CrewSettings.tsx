import { useState } from 'react';
import { doc, updateDoc, arrayRemove, deleteField, FieldValue } from 'firebase/firestore';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { db } from '../../firebase';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { useCrew } from '../../hooks/useSettings';
import { usePermissions } from '../../hooks/usePermissions';
import { CREW_ROLES, ROLE_LABEL_KEY, countOwners, getEffectiveRole } from '../../lib/permissions';
import { trackWrite } from '../../lib/pendingWrites';
import { MAX_CREW_NAME_LENGTH, addCrewMember, isCrewNameTaken, normalizeCrewName } from '../../lib/crew';
import { getUserColor } from '../../lib/userColors';
import { useT } from '../../i18n';
import { CrewRole } from '../../types';
import {
  IconButton,
  Input,
  Select,
  Section,
  ListItem,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';

interface Props {
  currentUser: string;
  users: string[];
}

export default function CrewSettings({ currentUser, users }: Props) {
  const { tripId } = useRoadtrip();
  const { roles } = useCrew();
  const { isOwner } = usePermissions(currentUser);
  const [newUser, setNewUser] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const { notify } = useToast();
  const t = useT();

  const saveCrew = (change: Record<string, FieldValue | string>) => {
    if (!tripId) return Promise.resolve();
    return trackWrite(updateDoc(doc(db, tripPath(tripId, 'settings', 'general')), change));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = normalizeCrewName(newUser);
    if (!name) return;
    if (isCrewNameTaken(users, name)) {
      notify(t('crew.alreadyAboard', { name }), 'danger');
      return;
    }
    if (!tripId) return;
    try {
      // Neue Mitglieder starten als Mitfahrer – die Rolle lässt sich danach
      // jederzeit über die Auswahl unten ändern. Derselbe Helfer wie beim
      // Selbst-Eintragen im CrewGate, damit beide Wege dasselbe schreiben.
      await trackWrite(addCrewMember(tripId, name, 'member'));
      setNewUser('');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    }
  };

  const handleRemoveClick = (name: string) => {
    if (name === currentUser) {
      notify(t('crew.cannotRemoveSelf'), 'danger');
      return;
    }
    setPendingRemoval(name);
  };

  const confirmRemoveUser = async () => {
    if (!pendingRemoval) return;
    try {
      await saveCrew({ users: arrayRemove(pendingRemoval), [`roles.${pendingRemoval}`]: deleteField() });
      notify(t('crew.removed', { name: pendingRemoval }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.deleteError'), 'danger');
    }
    setPendingRemoval(null);
  };

  const handleRoleChange = async (name: string, role: CrewRole) => {
    const current = getEffectiveRole(users, roles, name);
    if (current === role) return;
    // Mindestens ein Owner muss übrig bleiben, sonst kann niemand mehr die
    // Crew verwalten – auch nicht, um den Fehler zu korrigieren.
    if (current === 'owner' && role !== 'owner' && countOwners(users, roles) <= 1) {
      notify(t('crew.lastOwnerRequired'), 'danger');
      return;
    }
    try {
      await saveCrew({ [`roles.${name}`]: role });
      notify(t('crew.roleUpdated', { name, role: t(ROLE_LABEL_KEY[role]) }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    }
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('crew.title')}
        subtitle={t('crew.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      <Section title={t('crew.section', { count: users.length })}>
        {isOwner ? (
          <form onSubmit={handleAddUser} className="row settings-add-form">
            <Input
              placeholder={t('crew.newNamePlaceholder')}
              value={newUser}
              maxLength={MAX_CREW_NAME_LENGTH}
              onChange={(e) => setNewUser(e.target.value)}
            />
            <IconButton type="submit" label={t('crew.addMember')} tone="accent" disabled={!newUser.trim()}>
              <UserPlus size={20} />
            </IconButton>
          </form>
        ) : (
          <p className="helper-text setting-note">
            <ShieldCheck size={13} className="setting-note-icon" />
            {t('crew.onlyOwnerCanManage')}
          </p>
        )}

        <div className="settings-list">
          {users.map((name) => {
            const role = getEffectiveRole(users, roles, name);
            return (
              <ListItem
                key={name}
                leading={
                  <span className="avatar" style={{ background: getUserColor(name), color: '#ffffff' }}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                }
                title={
                  name === currentUser ? (
                    <span className="settings-list-self">{t('crew.self', { name })}</span>
                  ) : (
                    name
                  )
                }
                subtitle={!isOwner ? t(ROLE_LABEL_KEY[role]) : undefined}
                trailing={
                  isOwner ? (
                    <>
                      <Select
                        className="setting-select"
                        aria-label={t('crew.roleLabel', { name })}
                        value={role}
                        onChange={(e) => handleRoleChange(name, e.target.value as CrewRole)}
                      >
                        {CREW_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(ROLE_LABEL_KEY[r])}
                          </option>
                        ))}
                      </Select>
                      <IconButton
                        label={t('crew.removeMember', { name })}
                        tone="danger"
                        onClick={() => handleRemoveClick(name)}
                        disabled={name === currentUser}
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      </Section>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t('crew.removeTitle')}
        description={t('crew.removeDescription', { name: pendingRemoval ?? '' })}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={confirmRemoveUser}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
