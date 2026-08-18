import { useState, FormEvent } from 'react';
import { Compass, KeyRound, Plus, LifeBuoy, ShieldCheck, X } from 'lucide-react';
import { createRoadtrip, joinRoadtrip, recoverRoadtrip, MIN_PASSWORD_LENGTH } from '../lib/roadtrip';
import { msUntilUnlocked, recordAttemptFailure, recordAttemptSuccess } from '../lib/attemptThrottle';
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
  // Nur relevant im Beitreten-Tab: Passwort-Feld wird zum Code-Feld.
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { notify } = useToast();

  const resetForm = () => {
    setPassword('');
    setPasswordConfirm('');
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
      notify(`Zu viele Fehlversuche. Bitte ${Math.ceil(waitMs / 1000)} Sekunden warten.`, 'danger');
      return;
    }

    if (mode === 'create' && password !== passwordConfirm) {
      notify('Die Passwörter stimmen nicht überein.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await createRoadtrip(name, password);
        recordAttemptSuccess();
        onRoadtripCreated(result.tripName, result.recoveryCode);
      } else if (useRecoveryCode) {
        await recoverRoadtrip(name, password);
        recordAttemptSuccess();
        notify('Über Wiederherstellungscode angemeldet', 'success');
      } else {
        await joinRoadtrip(name, password);
        recordAttemptSuccess();
        notify('Roadtrip beigetreten', 'success');
      }
      // Kein manuelles Weiterleiten nötig: onAuthStateChanged in
      // RoadtripProvider übernimmt den Wechsel zur Crew-Anmeldung.
    } catch (err) {
      recordAttemptFailure();
      notify(err instanceof Error ? err.message : 'Da ist etwas schiefgelaufen.', 'danger');
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
          {mode === 'join'
            ? 'Roadtrip-Namen und Passwort der Crew eingeben, um beizutreten.'
            : 'Neuen Roadtrip anlegen und ein Passwort für die Crew festlegen.'}
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
          Beitreten
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`roadtrip-gate-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => switchMode('create')}
        >
          Roadtrip erstellen
        </button>
      </div>

      <form className="roadtrip-gate-form stack" onSubmit={handleSubmit}>
        <Input
          autoFocus
          placeholder="Roadtrip-Name, z.B. Sommertour 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type={useRecoveryCode ? 'text' : 'password'}
          placeholder={useRecoveryCode ? 'Wiederherstellungscode' : 'Passwort'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'create' ? MIN_PASSWORD_LENGTH : undefined}
          required
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        />
        {mode === 'create' && (
          <Input
            type="password"
            placeholder="Passwort bestätigen"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoComplete="new-password"
          />
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {mode === 'create' ? <Plus size={18} /> : <KeyRound size={18} />}
          {submitting
            ? 'Einen Moment …'
            : mode === 'create'
              ? 'Roadtrip anlegen'
              : useRecoveryCode
                ? 'Mit Code anmelden'
                : 'Beitreten'}
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
            {useRecoveryCode
              ? 'Doch mit normalem Passwort beitreten'
              : 'Passwort vergessen? Mit Wiederherstellungscode anmelden'}
          </button>
        )}
      </form>

      <p className="helper-text roadtrip-gate-hint">
        {mode === 'create'
          ? 'Nach dem Anlegen zeigen wir dir einmalig einen Wiederherstellungscode – damit kommt ihr auch dann noch rein, wenn das Passwort mal vergessen wird.'
          : 'Das Passwort teilst du der Crew z.B. persönlich oder per Chat mit – nur damit können andere diesem Roadtrip beitreten und Einträge sehen oder ändern.'}
      </p>

      <button type="button" className="roadtrip-gate-privacy-link" onClick={() => setShowPrivacy(true)}>
        <ShieldCheck size={13} />
        Datenschutz
      </button>

      {showPrivacy && (
        <div className="roadtrip-gate-privacy-overlay" role="dialog" aria-modal="true">
          <div className="roadtrip-gate-privacy-panel">
            <button
              type="button"
              className="roadtrip-gate-privacy-close"
              onClick={() => setShowPrivacy(false)}
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
            <h1 className="page-title">Datenschutz</h1>
            <PrivacyContent />
          </div>
        </div>
      )}
    </div>
  );
}
