import { useState, FormEvent } from 'react';
import { Compass, KeyRound, Plus, LifeBuoy, ShieldCheck, X } from 'lucide-react';
import { createRoadtrip, joinRoadtrip, recoverRoadtrip, MIN_PASSWORD_LENGTH, RoadtripAuthError } from '../lib/roadtrip';
import { msUntilUnlocked, recordAttemptFailure, recordAttemptSuccess } from '../lib/attemptThrottle';
import { useT } from '../i18n';
import { PrivacyContent } from './Privacy';
import { Button, Input, useToast } from '../components/ui';
import './RoadtripGate.css';

type Mode = 'join' | 'create';

interface RoadtripGateProps {
  /**
   * Feuert, sobald ein neuer Roadtrip inklusive Wiederherstellungscode
   * angelegt ist. Der Code muss außerhalb dieser Komponente angezeigt
   * werden: Sobald createRoadtrip erfolgreich ist, ändert sich der
   * Auth-Status und App.tsx blendet auf die Crew-Anmeldung um – dieser
   * Screen hier wäre zu dem Zeitpunkt schon unmontiert.
   */
  onRoadtripCreated: (tripName: string, recoveryCode: string) => void;
}

/**
 * Vorgelagerter Screen vor der eigentlichen Crew-Anmeldung: Ohne einen
 * bestehenden oder neu angelegten Roadtrip gibt es keinen Firestore-Zugriff
 * (siehe firestore.rules) – wer den Link kennt, kommt also nicht mehr ohne
 * Passwort an Daten.
 */
export default function RoadtripGate({ onRoadtripCreated }: RoadtripGateProps) {
  const [mode, setMode] = useState<Mode>('join');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  // Nur im Erstellen-Tab: Reisezeitraum, siehe hooks/useSettings.ts
  // (useTripDates) und den Kombüse-Speiseplan, der ihn braucht.
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  // Nur relevant im Beitreten-Tab: Passwort-Feld wird zum Code-Feld.
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const resetForm = () => {
    setPassword('');
    setPasswordConfirm('');
    setAdminPassword('');
    setTripStartDate('');
    setTripEndDate('');
    setUseRecoveryCode(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Rein clientseitige Bremse gegen ungezieltes Durchprobieren im Browser
    // – kein Ersatz für echten Schutz, siehe lib/attemptThrottle.ts.
    const waitMs = msUntilUnlocked();
    if (waitMs > 0) {
      notify(t('gate.throttled', { seconds: Math.ceil(waitMs / 1000) }), 'danger');
      return;
    }

    if (mode === 'create' && password !== passwordConfirm) {
      notify(t('gate.passwordMismatch'), 'danger');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await createRoadtrip(name, password, adminPassword, tripStartDate, tripEndDate);
        recordAttemptSuccess();
        onRoadtripCreated(result.tripName, result.recoveryCode);
      } else if (useRecoveryCode) {
        await recoverRoadtrip(name, password);
        recordAttemptSuccess();
        notify(t('gate.recoverySuccess'), 'success');
      } else {
        await joinRoadtrip(name, password);
        recordAttemptSuccess();
        notify(t('gate.joinSuccess'), 'success');
      }
      // Kein manuelles Weiterleiten nötig: onAuthStateChanged in
      // RoadtripProvider übernimmt den Wechsel zur Crew-Anmeldung.
    } catch (err) {
      recordAttemptFailure();
      const code = err instanceof RoadtripAuthError ? err.code : 'unknown';
      notify(
        t(`authError.${code}` as Parameters<typeof t>[0], { min: MIN_PASSWORD_LENGTH }),
        'danger'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="roadtrip-gate">
      <div className="roadtrip-gate-head">
        <Compass size={26} />
        <h1 className="page-title">2cars2georgia</h1>
        <p className="helper-text">
          {mode === 'join' ? t('gate.joinHint') : t('gate.createHint')}
        </p>
      </div>

      <div className="roadtrip-gate-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          className={`roadtrip-gate-tab ${mode === 'join' ? 'active' : ''}`}
          onClick={() => switchMode('join')}
        >
          {t('gate.tabJoin')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`roadtrip-gate-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => switchMode('create')}
        >
          {t('gate.tabCreate')}
        </button>
      </div>

      <form className="roadtrip-gate-form stack" onSubmit={handleSubmit}>
        <Input
          autoFocus
          placeholder={t('gate.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type={useRecoveryCode ? 'text' : 'password'}
          placeholder={useRecoveryCode ? t('gate.recoveryCodePlaceholder') : t('gate.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'create' ? MIN_PASSWORD_LENGTH : undefined}
          required
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        />
        {mode === 'create' && (
          <>
            <Input
              type="password"
              placeholder={t('gate.passwordConfirmPlaceholder')}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
              autoComplete="new-password"
            />
            <Input
              type="password"
              placeholder={t('gate.adminPasswordPlaceholder')}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
              autoComplete="new-password"
            />
            <p className="helper-text roadtrip-gate-hint">{t('gate.adminPasswordHint')}</p>
            <div className="row roadtrip-gate-dates">
              <Input
                type="date"
                aria-label={t('gate.startDatePlaceholder')}
                value={tripStartDate}
                onChange={(e) => setTripStartDate(e.target.value)}
                required
              />
              <Input
                type="date"
                aria-label={t('gate.endDatePlaceholder')}
                value={tripEndDate}
                onChange={(e) => setTripEndDate(e.target.value)}
                min={tripStartDate || undefined}
                required
              />
            </div>
            <p className="helper-text roadtrip-gate-hint">{t('gate.tripDatesHint')}</p>
          </>
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {mode === 'create' ? <Plus size={18} /> : <KeyRound size={18} />}
          {submitting
            ? t('gate.submitting')
            : mode === 'create'
              ? t('gate.createSubmit')
              : useRecoveryCode
                ? t('gate.recoverySubmit')
                : t('gate.joinSubmit')}
        </Button>

        {mode === 'join' && (
          <button
            type="button"
            className="roadtrip-gate-recovery-link"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setPassword('');
            }}
          >
            <LifeBuoy size={14} />
            {useRecoveryCode ? t('gate.usePassword') : t('gate.useRecoveryCode')}
          </button>
        )}
      </form>

      <p className="helper-text roadtrip-gate-hint">
        {mode === 'create' ? t('gate.createFootnote') : t('gate.joinFootnote')}
      </p>

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
