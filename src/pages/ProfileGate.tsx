import { useState, FormEvent } from 'react';
import { Compass } from 'lucide-react';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { MAX_DISPLAY_NAME_LENGTH, UsernameError, reserveDisplayName } from '../lib/username';
import { useT } from '../i18n';
import { Button, Input, useToast } from '../components/ui';

/**
 * Zweiter Schritt der App-Flow (siehe App.tsx): angemeldet, aber noch kein
 * Profil (users/{uid}). Legt einen eindeutigen Anzeigenamen fest – die
 * Eindeutigkeit erzwingt lib/username.ts serverseitig über
 * usernames/{normalizedName}, nicht nur diese Oberfläche.
 */
export default function ProfileGate() {
  const { authUser } = useRoadtrip();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !authUser?.email) return;

    setSubmitting(true);
    try {
      await reserveDisplayName(authUser.uid, authUser.email, name);
      // Kein manuelles Weiterleiten nötig: der onSnapshot auf users/{uid} in
      // RoadtripProvider übernimmt den Wechsel zum Roadtrip-Gate.
    } catch (err) {
      const code = err instanceof UsernameError ? err.code : 'unknown';
      notify(t(`profileError.${code}` as Parameters<typeof t>[0]), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-screen-head">
        <Compass size={26} />
        <h1 className="page-title">{t('profile.title')}</h1>
        <p className="helper-text">{t('profile.hint')}</p>
      </div>
      <form className="login-join" onSubmit={handleSubmit}>
        <label className="label" htmlFor="profile-display-name">
          {t('profile.namePlaceholder')}
        </label>
        <div className="row">
          <Input
            id="profile-display-name"
            autoFocus
            placeholder={t('profile.namePlaceholder')}
            value={name}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={!name.trim() || submitting}>
            {t('profile.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
