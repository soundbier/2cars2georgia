import { useEffect, useState, FormEvent } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Compass, Plus, LogIn, ShieldCheck, MailCheck, X, Hourglass } from 'lucide-react';
import { db } from '../firebase';
import { useRoadtrip } from '../hooks/useRoadtrip';
import {
  createRoadtrip,
  requestJoin,
  withdrawJoinRequest,
  MembershipError
} from '../lib/membership';
import {
  AuthAccountError,
  ensureEmailVerified,
  resendVerificationForCurrentUser
} from '../lib/authAccount';
import { useT } from '../i18n';
import { PrivacyContent } from './Privacy';
import { Button, Input, useToast } from '../components/ui';
import './RoadtripGate.css';

type Mode = 'join' | 'create';

/** Gestellter, noch nicht freigegebener Antrag – überlebt das Neuladen. */
const STORAGE_KEY_PENDING = 'pending_join_trip';

interface PendingJoin {
  tripId: string;
  tripName: string;
}

function readPendingJoin(): PendingJoin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingJoin>;
    if (typeof parsed.tripId !== 'string' || !parsed.tripId) return null;
    return { tripId: parsed.tripId, tripName: parsed.tripName ?? parsed.tripId };
  } catch {
    return null;
  }
}

/**
 * Screen zwischen Profil und App: Angemeldete Person ohne aktiven Roadtrip
 * erstellt einen neuen oder bewirbt sich um einen bestehenden.
 *
 * Beitreten ist kein Selbstbedienungsvorgang: Die Roadtrip-ID öffnet nur den
 * Antrag, aufgenommen wird man vom Owner (siehe lib/membership.ts und
 * firestore.rules). Der Antrag steht deshalb hier als eigener Zustand –
 * gespeichert, damit ein Neuladen nicht wieder beim leeren Formular landet,
 * und mit einem Blick auf die eigene Mitgliedschaft, der von selbst
 * weiterschaltet, sobald der Owner freigegeben hat.
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
  // Wird gesetzt, sobald ein Versuch an der fehlenden E-Mail-Bestätigung
  // gescheitert ist – erst dann bekommt der Screen den Hinweis samt
  // erneutem Versand, statt ihn allen vorab hinzuwerfen.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pending, setPending] = useState<PendingJoin | null>(readPendingJoin);
  const { notify } = useToast();
  const t = useT();

  // Wartet auf die Freigabe: Das eigene Mitgliedschafts-Dokument darf man
  // auch ohne Mitgliedschaft lesen (siehe firestore.rules) – taucht es auf,
  // hat der Owner aufgenommen und es geht ohne weiteres Zutun weiter.
  useEffect(() => {
    if (!pending || !authUser) return;
    return onSnapshot(
      doc(db, 'roadtrips', pending.tripId, 'members', authUser.uid),
      (snap) => {
        if (!snap.exists()) return;
        localStorage.removeItem(STORAGE_KEY_PENDING);
        setPending(null);
        selectTrip(pending.tripId);
        notify(t('trip.joinApproved', { tripName: pending.tripName }), 'success');
      },
      // Ein Fehler hier heißt nicht „abgelehnt": Er kann auch am Netz liegen.
      // Der Antrag bleibt stehen, der nächste Versuch kommt von selbst.
      () => undefined
    );
  }, [pending, authUser, selectTrip, notify, t]);

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
      // Serverseitig verweigern die Firestore-Regeln das Anlegen einer
      // Mitgliedschaft ohne bestätigte E-Mail-Adresse (siehe
      // firestore.rules, emailVerified()). Hier wird derselbe Stand frisch
      // geholt – das liefert die verständliche Meldung statt eines nackten
      // "permission denied" und erneuert zugleich den Token, wenn die
      // Bestätigung inzwischen erfolgt ist.
      await ensureEmailVerified();
      setNeedsVerification(false);

      if (mode === 'create') {
        const result = await createRoadtrip(authUser.uid, displayName, name, tripStartDate, tripEndDate);
        selectTrip(result.tripId);
        notify(t('trip.createdSuccess', { tripName: result.tripName }), 'success');
      } else {
        const result = await requestJoin(authUser.uid, displayName, joinId.trim());
        if (result.alreadyMember) {
          selectTrip(result.tripId);
          notify(t('trip.joinSuccess', { tripName: result.tripName }), 'success');
        } else {
          const next = { tripId: result.tripId, tripName: result.tripName };
          localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(next));
          setPending(next);
          notify(t('trip.joinRequested', { tripName: result.tripName }), 'success');
        }
      }
    } catch (err) {
      if (err instanceof AuthAccountError) {
        setNeedsVerification(true);
        notify(t(`authError.${err.code}` as Parameters<typeof t>[0]), 'danger');
      } else {
        const code = err instanceof MembershipError ? err.code : 'unknown';
        notify(t(`tripError.${code}` as Parameters<typeof t>[0]), 'danger');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (submitting || !pending || !authUser) return;
    setSubmitting(true);
    try {
      await withdrawJoinRequest(pending.tripId, authUser.uid);
      localStorage.removeItem(STORAGE_KEY_PENDING);
      setPending(null);
      setJoinId('');
      notify(t('trip.joinWithdrawn'), 'info');
    } catch (err) {
      console.error(err);
      notify(t('common.deleteError'), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await resendVerificationForCurrentUser();
      notify(t('auth.verificationSent'), 'success');
    } catch (err) {
      const code = err instanceof AuthAccountError ? err.code : 'unknown';
      notify(
        t(`authError.${code}` as Parameters<typeof t>[0]),
        code === 'alreadyVerified' ? 'info' : 'danger'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* Gestellter Antrag: Formular und Umschalter fallen weg – es gibt genau
     eine sinnvolle Handlung, nämlich warten (oder es sich anders überlegen).
     Weiter geht es von selbst, sobald der Owner freigegeben hat. */
  if (pending) {
    return (
      <div className="roadtrip-gate">
        <div className="roadtrip-gate-head">
          <Hourglass size={26} />
          <h1 className="page-title">{t('trip.pendingTitle')}</h1>
          <p className="helper-text">{t('trip.pendingHint', { tripName: pending.tripName })}</p>
        </div>

        <p className="helper-text roadtrip-gate-hint">{t('trip.pendingFootnote')}</p>

        <Button type="button" variant="secondary" fullWidth disabled={submitting} onClick={handleWithdraw}>
          <X size={18} />
          {t('trip.withdrawRequest')}
        </Button>
      </div>
    );
  }

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
          {submitting
            ? t('trip.submitting')
            : mode === 'create'
              ? t('trip.createSubmit')
              : t('trip.requestSubmit')}
        </Button>
      </form>

      {needsVerification && (
        <>
          <p className="helper-text roadtrip-gate-hint">{t('trip.verifyRequiredHint')}</p>
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
