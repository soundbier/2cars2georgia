import { useState, FormEvent } from 'react';
import { Compass, Plus, LogIn, ShieldCheck, X } from 'lucide-react';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { createRoadtrip, joinRoadtrip, MembershipError } from '../lib/membership';
import { useT } from '../i18n';
import { PrivacyContent } from './Privacy';
import { Button, Input, useToast } from '../components/ui';
import './RoadtripGate.css';

type Mode = 'join' | 'create';

/**
 * Screen zwischen Profil und App: Angemeldete Person ohne aktiven Roadtrip
 * erstellt einen neuen oder tritt einem bestehenden bei. Anders als früher
 * gibt es kein Roadtrip-Passwort mehr – Schutz ist die echte Anmeldung
 * (siehe firestore.rules), die Roadtrip-ID dient nur als Beitritts-Code.
 */
export default function RoadtripGate() {
  const { authUser, displayName, selectTrip } = useRoadtrip();
  const [mode, setMode] = useState<Mode>('join');
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const switchMode = (next: Mode) => {
    setMode(next);
    setName('');
    setJoinId('');
    setTripStartDate('');
    setTripEndDate('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !authUser || !displayName) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await createRoadtrip(authUser.uid, displayName, name, tripStartDate, tripEndDate);
        selectTrip(result.tripId);
        notify(t('trip.createdSuccess', { tripName: result.tripName }), 'success');
      } else {
        const result = await joinRoadtrip(authUser.uid, displayName, joinId.trim());
        selectTrip(result.tripId);
        notify(t('trip.joinSuccess', { tripName: result.tripName }), 'success');
      }
    } catch (err) {
      const code = err instanceof MembershipError ? err.code : 'unknown';
      notify(t(`tripError.${code}` as Parameters<typeof t>[0]), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="roadtrip-gate">
      <div className="roadtrip-gate-head">
        <Compass size={26} />
        <h1 className="page-title">2cars2georgia</h1>
        <p className="helper-text">{mode === 'join' ? t('trip.joinHint') : t('trip.createHint')}</p>
      </div>

      <div className="roadtrip-gate-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          className={`roadtrip-gate-tab ${mode === 'join' ? 'active' : ''}`}
          onClick={() => switchMode('join')}
        >
          {t('trip.tabJoin')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`roadtrip-gate-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => switchMode('create')}
        >
          {t('trip.tabCreate')}
        </button>
      </div>

      <form className="roadtrip-gate-form stack" onSubmit={handleSubmit}>
        {mode === 'join' ? (
          <Input
            autoFocus
            placeholder={t('trip.joinIdPlaceholder')}
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            required
          />
        ) : (
          <>
            <Input
              autoFocus
              placeholder={t('trip.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="row roadtrip-gate-dates">
              <div className="roadtrip-gate-date-field">
                <label className="label" htmlFor="trip-start-date">
                  {t('trip.startDatePlaceholder')}
                </label>
                <Input
                  id="trip-start-date"
                  type="date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="roadtrip-gate-date-field">
                <label className="label" htmlFor="trip-end-date">
                  {t('trip.endDatePlaceholder')}
                </label>
                <Input
                  id="trip-end-date"
                  type="date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  min={tripStartDate || undefined}
                  required
                />
              </div>
            </div>
            <p className="helper-text roadtrip-gate-hint">{t('trip.tripDatesHint')}</p>
          </>
        )}

        <Button type="submit" fullWidth disabled={submitting}>
          {mode === 'create' ? <Plus size={18} /> : <LogIn size={18} />}
          {submitting ? t('trip.submitting') : mode === 'create' ? t('trip.createSubmit') : t('trip.joinSubmit')}
        </Button>
      </form>

      <p className="helper-text roadtrip-gate-hint">
        {mode === 'create' ? t('trip.createFootnote') : t('trip.joinFootnote')}
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
