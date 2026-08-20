import { useState, FormEvent } from 'react';
import { Compass, LogIn, UserPlus, ShieldCheck, MailCheck, X } from 'lucide-react';
import {
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  resendVerificationEmail,
  AuthAccountError,
  MIN_PASSWORD_LENGTH
} from '../lib/authAccount';
import { useT } from '../i18n';
import { PrivacyContent } from './Privacy';
import { Button, Input, useToast } from '../components/ui';
import './RoadtripGate.css';

type Mode = 'signIn' | 'signUp';

export default function AuthGate() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setPasswordConfirm('');
  };

  const reportError = (err: unknown) => {
    const code = err instanceof AuthAccountError ? err.code : 'unknown';
    notify(t(`authError.${code}` as Parameters<typeof t>[0], { min: MIN_PASSWORD_LENGTH }), 'danger');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === 'signUp' && password !== passwordConfirm) {
      notify(t('auth.passwordMismatch'), 'danger');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        await registerWithEmail(email, password);
        notify(t('auth.verifyEmailSent'), 'success');
        switchMode('signIn');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Erneuter Versand der Bestätigungs-Mail. Firebase verschickt sie nur für
   * ein angemeldetes Konto, deshalb wird hier auch das Passwort gebraucht –
   * lib/authAccount.ts meldet dafür kurz an und sofort wieder ab.
   */
  const handleResendVerification = async () => {
    if (submitting) return;
    if (!email.trim() || !password) {
      notify(t('auth.resendNeedsCredentials'), 'danger');
      return;
    }
    setSubmitting(true);
    try {
      await resendVerificationEmail(email, password);
      notify(t('auth.verificationSent'), 'success');
    } catch (err) {
      const code = err instanceof AuthAccountError ? err.code : 'unknown';
      // „Bereits bestätigt“ ist kein Fehler, sondern eine gute Nachricht.
      notify(t(`authError.${code}` as Parameters<typeof t>[0], { min: MIN_PASSWORD_LENGTH }),
        code === 'alreadyVerified' ? 'info' : 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      notify(t('auth.resetNeedsEmail'), 'danger');
      return;
    }
    try {
      await sendPasswordReset(email);
      notify(t('auth.resetSent'), 'success');
    } catch (err) {
      reportError(err);
    }
  };

  return (
    <div className="roadtrip-gate">
      <div className="roadtrip-gate-head">
        <Compass size={26} />
        <h1 className="page-title">2cars2georgia</h1>
        <p className="helper-text">{mode === 'signIn' ? t('auth.signInHint') : t('auth.signUpHint')}</p>
      </div>

      <div className="roadtrip-gate-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signIn'}
          className={`roadtrip-gate-tab ${mode === 'signIn' ? 'active' : ''}`}
          onClick={() => switchMode('signIn')}
        >
          {t('auth.tabSignIn')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signUp'}
          className={`roadtrip-gate-tab ${mode === 'signUp' ? 'active' : ''}`}
          onClick={() => switchMode('signUp')}
        >
          {t('auth.tabSignUp')}
        </button>
      </div>

      <form className="roadtrip-gate-form stack" onSubmit={handleSubmit}>
        <Input
          autoFocus
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          type="password"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'signUp' ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          required
        />
        {mode === 'signUp' && (
          <Input
            type="password"
            placeholder={t('auth.passwordConfirmPlaceholder')}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            required
          />
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {mode === 'signUp' ? <UserPlus size={18} /> : <LogIn size={18} />}
          {submitting ? t('auth.submitting') : mode === 'signUp' ? t('auth.signUpSubmit') : t('auth.signInSubmit')}
        </Button>

        {mode === 'signIn' && (
          <>
            <button type="button" className="roadtrip-gate-recovery-link" onClick={handleForgotPassword}>
              {t('auth.forgotPassword')}
            </button>
            <button
              type="button"
              className="roadtrip-gate-recovery-link"
              disabled={submitting}
              onClick={handleResendVerification}
            >
              <MailCheck size={13} />
              {t('auth.resendVerification')}
            </button>
          </>
        )}
      </form>

      <p className="helper-text roadtrip-gate-hint">{t('auth.orDivider')}</p>

      <Button type="button" variant="secondary" fullWidth disabled={submitting} onClick={handleGoogle}>
        {t('auth.google')}
      </Button>

      <button type="button" className="roadtrip-gate-privacy-link" onClick={() => setShowPrivacy(true)}>
        <ShieldCheck size={13} />
        {t('settings.privacy')}
      </button>

      {showPrivacy && (
        <div className="roadtrip-gate-privacy-overlay" role="dialog" aria-modal="true">
          <div className="roadtrip-gate-privacy-panel">
            <button
              type="button"
              className="roadtrip-gate-privacy-close"
              onClick={() => setShowPrivacy(false)}
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
            <h1 className="page-title">{t('privacy.title')}</h1>
            <PrivacyContent />
          </div>
        </div>
      )}
    </div>
  );
}
