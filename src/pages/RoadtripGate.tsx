import { useState, FormEvent } from 'react';
import { Compass, KeyRound, Plus } from 'lucide-react';
import { createRoadtrip, joinRoadtrip, MIN_PASSWORD_LENGTH } from '../lib/roadtrip';
import { Button, Input, useToast } from '../components/ui';
import './RoadtripGate.css';

type Mode = 'join' | 'create';

/**
 * Vorgelagerter Screen vor der eigentlichen Crew-Anmeldung: Ohne einen
 * bestehenden oder neu angelegten Roadtrip gibt es keinen Firestore-Zugriff
 * (siehe firestore.rules) – wer den Link kennt, kommt also nicht mehr ohne
 * Passwort an Daten.
 */
export default function RoadtripGate() {
  const [mode, setMode] = useState<Mode>('join');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useToast();

  const resetForm = () => {
    setPassword('');
    setPasswordConfirm('');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === 'create' && password !== passwordConfirm) {
      notify('Die Passwörter stimmen nicht überein.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createRoadtrip(name, password);
        notify('Roadtrip angelegt', 'success');
      } else {
        await joinRoadtrip(name, password);
        notify('Roadtrip beigetreten', 'success');
      }
      // Kein manuelles Weiterleiten nötig: onAuthStateChanged in
      // RoadtripProvider übernimmt den Wechsel zur Crew-Anmeldung.
    } catch (err) {
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
          type="password"
          placeholder="Passwort"
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
              : 'Beitreten'}
        </Button>
      </form>

      <p className="helper-text roadtrip-gate-hint">
        Das Passwort teilst du der Crew z.B. persönlich oder per Chat mit – nur damit können
        andere diesem Roadtrip beitreten und Einträge sehen oder ändern.
      </p>
    </div>
  );
}
