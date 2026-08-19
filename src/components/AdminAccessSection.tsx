import { FormEvent, useState } from 'react';
import { ShieldCheck, ShieldPlus } from 'lucide-react';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { enterAdminMode, setUpAdminAccess, MIN_PASSWORD_LENGTH, RoadtripAuthError } from '../lib/roadtrip';
import { useT } from '../i18n';
import { Button, Input, Section, useToast } from './ui';

/**
 * Admin-Modus: die zweite Schranke vor den Aktionen, die sich nicht
 * rückgängig machen lassen (endgültiges Löschen, Crew verwalten).
 *
 * Technisch ist das ein eigener Auth-User pro Roadtrip mit eigenem Passwort
 * (siehe lib/roadtrip.ts). Durchgesetzt wird es in firestore.rules – diese
 * Oberfläche blendet nur ein, was die Regeln ohnehin erlauben würden.
 *
 * Es gibt bewusst keinen Knopf "Admin-Modus beenden": Der Rückweg auf den
 * normalen Zugang braucht das Roadtrip-Passwort, und das liegt auf dem Gerät
 * nirgends gespeichert. Wer den Modus verlassen will, verlässt den Roadtrip
 * und meldet sich normal wieder an.
 */
export function AdminAccessSection() {
  const { tripId, isAdmin } = useRoadtrip();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const run = async (action: () => Promise<void>, successKey: 'admin.entered' | 'admin.setUpSuccess') => {
    if (!tripId || submitting) return;
    setSubmitting(true);
    try {
      await action();
      setPassword('');
      notify(t(successKey), 'success');
    } catch (err) {
      const code = err instanceof RoadtripAuthError ? err.code : 'unknown';
      notify(
        t(`authError.${code}` as Parameters<typeof t>[0], { min: MIN_PASSWORD_LENGTH }),
        'danger'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnter = (e: FormEvent) => {
    e.preventDefault();
    void run(() => enterAdminMode(tripId!, password), 'admin.entered');
  };

  const handleSetUp = () => {
    void run(() => setUpAdminAccess(tripId!, password), 'admin.setUpSuccess');
  };

  if (isAdmin) {
    return (
      <Section title={t('admin.title')}>
        <p className="helper-text setting-note">
          <ShieldCheck size={13} className="setting-note-icon" />
          {t('admin.active')}
        </p>
        <p className="helper-text">{t('admin.activeHint')}</p>
      </Section>
    );
  }

  return (
    <Section title={t('admin.title')}>
      <p className="helper-text">{t('admin.enterHint')}</p>
      <form className="stack" onSubmit={handleEnter}>
        <Input
          type="password"
          placeholder={t('admin.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="off"
        />
        <Button type="submit" fullWidth disabled={!password || submitting}>
          <ShieldCheck size={18} /> {t('admin.start')}
        </Button>
      </form>

      <p className="helper-text setting-note">{t('admin.setUpTitle')}</p>
      <p className="helper-text">{t('admin.setUpHint')}</p>
      <Button variant="secondary" fullWidth disabled={!password || submitting} onClick={handleSetUp}>
        <ShieldPlus size={18} /> {t('admin.setUp')}
      </Button>
    </Section>
  );
}
