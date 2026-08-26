import { useState } from 'react';
import { Trash2, ShieldCheck, Copy, Check, UserCheck, UserX } from 'lucide-react';
import { useRoadtrip } from '../../hooks/useRoadtrip';
import { useCrew, useJoinRequests } from '../../hooks/useSettings';
import { usePermissions } from '../../hooks/usePermissions';
import { CREW_ROLES, ROLE_LABEL_KEY, countOwners } from '../../lib/permissions';
import {
  approveJoinRequest,
  rejectJoinRequest,
  removeMember,
  updateMemberRole
} from '../../lib/membership';
import { trackWrite } from '../../lib/pendingWrites';
import { getUserColor } from '../../lib/userColors';
import { useI18n, useT } from '../../i18n';
import { CrewRole } from '../../types';
import {
  Button,
  IconButton,
  Select,
  Section,
  ListItem,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';

/**
 * Crew-Verwaltung eines Roadtrips: offene Beitrittsanfragen, Liste der
 * Mitglieder aus roadtrips/{tripId}/members (siehe hooks/useSettings.ts),
 * Rollen vergeben und entfernen.
 *
 * Die Anfragen stehen oben, weil sie die einzige Stelle sind, an der etwas
 * auf eine Entscheidung wartet: Niemand kommt mehr von selbst in einen
 * Roadtrip, die Roadtrip-ID öffnet nur die Anfrage (siehe lib/membership.ts
 * und firestore.rules). Angemeldete Person und Mitgliederliste kommen direkt
 * aus dem Kontext (useRoadtrip/useCrew), nicht aus Props.
 */
export default function CrewSettings() {
  const { tripId, authUser } = useRoadtrip();
  const { members } = useCrew();
  const { isOwner } = usePermissions();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [pendingRejection, setPendingRejection] = useState<string | null>(null);
  const [busyRequest, setBusyRequest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { requests } = useJoinRequests(isOwner);
  const { locale } = useI18n();
  const { notify } = useToast();
  const t = useT();

  const handleCopyTripId = async () => {
    if (!tripId) return;
    try {
      await navigator.clipboard.writeText(tripId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API kann fehlen/verweigert werden – die ID steht ohnehin
      // lesbar da, Abtippen bleibt möglich.
    }
  };

  const handleApprove = async (uid: string, name: string) => {
    if (!tripId || busyRequest) return;
    setBusyRequest(uid);
    try {
      // Der Anzeigename kommt aus der Anfrage, nicht aus einem Eingabefeld:
      // Die Regel für members verlangt, dass beide übereinstimmen.
      await trackWrite(approveJoinRequest(tripId, uid, name));
      notify(t('crew.approved', { name }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    } finally {
      setBusyRequest(null);
    }
  };

  const confirmReject = async () => {
    const target = requests.find((r) => r.uid === pendingRejection);
    if (!tripId || !pendingRejection || !target) {
      setPendingRejection(null);
      return;
    }
    try {
      await trackWrite(rejectJoinRequest(tripId, pendingRejection));
      notify(t('crew.rejected', { name: target.displayName }), 'info');
    } catch (err) {
      console.error(err);
      notify(t('common.deleteError'), 'danger');
    }
    setPendingRejection(null);
  };

  const handleRemoveClick = (uid: string) => {
    if (uid === authUser?.uid) {
      notify(t('crew.cannotRemoveSelf'), 'danger');
      return;
    }
    setPendingRemoval(uid);
  };

  const confirmRemoveUser = async () => {
    if (!pendingRemoval || !tripId) return;
    const target = members.find((m) => m.uid === pendingRemoval);
    try {
      await trackWrite(removeMember(tripId, pendingRemoval));
      notify(t('crew.removed', { name: target?.displayName ?? '' }), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.deleteError'), 'danger');
    }
    setPendingRemoval(null);
  };

  const handleRoleChange = async (uid: string, name: string, role: CrewRole) => {
    if (!tripId) return;
    const current = members.find((m) => m.uid === uid)?.role;
    if (current === role) return;
    // Mindestens ein Owner muss übrig bleiben, sonst kann niemand mehr die
    // Crew verwalten – auch nicht, um den Fehler zu korrigieren. Nur eine
    // UI-Warnung: firestore.rules kennt diese Zählung nicht (siehe
    // lib/permissions.ts), das Gerät mit dem letzten Owner könnte sie
    // theoretisch umgehen.
    if (current === 'owner' && role !== 'owner' && countOwners(members) <= 1) {
      notify(t('crew.lastOwnerRequired'), 'danger');
      return;
    }
    try {
      await trackWrite(updateMemberRole(tripId, uid, role));
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

      <Section title={t('crew.inviteTitle')}>
        <p className="helper-text">{t('crew.inviteHint')}</p>
        <div className="row settings-add-form">
          <code className="recovery-code-value">{tripId}</code>
          <Button type="button" variant="secondary" onClick={handleCopyTripId}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('recovery.copied') : t('recovery.copy')}
          </Button>
        </div>
      </Section>

      {/* Nur für den Owner – alle anderen dürfen die Anfragen nicht einmal
          lesen (siehe firestore.rules). */}
      {isOwner && (
        <Section title={t('crew.requestsTitle', { count: requests.length })}>
          {requests.length === 0 ? (
            <p className="helper-text">{t('crew.requestsEmpty')}</p>
          ) : (
            <div className="settings-list">
              {requests.map(({ uid, displayName, requestedAt }) => (
                <ListItem
                  key={uid}
                  leading={
                    <span
                      className="avatar"
                      style={{ background: getUserColor(displayName), color: '#ffffff' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  }
                  title={displayName}
                  subtitle={
                    requestedAt
                      ? t('crew.requestSubtitle', {
                          date: new Date(requestedAt).toLocaleString(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        })
                      : t('crew.requestSubtitlePending')
                  }
                  trailing={
                    <>
                      <IconButton
                        label={t('crew.approve', { name: displayName })}
                        disabled={busyRequest === uid}
                        onClick={() => handleApprove(uid, displayName)}
                      >
                        <UserCheck size={17} />
                      </IconButton>
                      <IconButton
                        label={t('crew.reject', { name: displayName })}
                        tone="danger"
                        disabled={busyRequest === uid}
                        onClick={() => setPendingRejection(uid)}
                      >
                        <UserX size={17} />
                      </IconButton>
                    </>
                  }
                />
              ))}
            </div>
          )}
          <p className="helper-text setting-note">
            <ShieldCheck size={13} className="setting-note-icon" />
            {t('crew.requestsHint')}
          </p>
        </Section>
      )}

      <Section title={t('crew.section', { count: members.length })}>
        {!isOwner && (
          <p className="helper-text setting-note">
            <ShieldCheck size={13} className="setting-note-icon" />
            {t('crew.onlyOwnerCanManage')}
          </p>
        )}

        <div className="settings-list">
          {members.map(({ uid, displayName, role }) => (
            <ListItem
              key={uid}
              leading={
                <span className="avatar" style={{ background: getUserColor(displayName), color: '#ffffff' }}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              }
              title={
                uid === authUser?.uid ? (
                  <span className="settings-list-self">{t('crew.self', { name: displayName })}</span>
                ) : (
                  displayName
                )
              }
              subtitle={!isOwner ? t(ROLE_LABEL_KEY[role]) : undefined}
              trailing={
                isOwner ? (
                  <>
                    <Select
                      className="setting-select"
                      aria-label={t('crew.roleLabel', { name: displayName })}
                      value={role}
                      onChange={(e) => handleRoleChange(uid, displayName, e.target.value as CrewRole)}
                    >
                      {CREW_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(ROLE_LABEL_KEY[r])}
                        </option>
                      ))}
                    </Select>
                    <IconButton
                      label={t('crew.removeMember', { name: displayName })}
                      tone="danger"
                      onClick={() => handleRemoveClick(uid)}
                      disabled={uid === authUser?.uid}
                    >
                      <Trash2 size={17} />
                    </IconButton>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      </Section>

      <ConfirmDialog
        open={pendingRejection !== null}
        title={t('crew.rejectTitle')}
        description={t('crew.rejectDescription', {
          name: requests.find((r) => r.uid === pendingRejection)?.displayName ?? ''
        })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmReject}
        onCancel={() => setPendingRejection(null)}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t('crew.removeTitle')}
        description={t('crew.removeDescription', {
          name: members.find((m) => m.uid === pendingRemoval)?.displayName ?? ''
        })}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={confirmRemoveUser}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
