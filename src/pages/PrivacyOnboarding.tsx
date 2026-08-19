import { ReactNode } from 'react';
import { Compass, ShieldCheck } from 'lucide-react';
import { PrivacyContent } from './Privacy';
import { usePrivacyConsent } from '../hooks/usePrivacyConsent';
import { useT } from '../i18n';
import { Button } from '../components/ui';
import './PrivacyOnboarding.css';

/**
 * Blendet einmalig vor allem anderen ein – noch vor AuthGate, siehe App.tsx –
 * und muss aktiv bestätigt werden, bevor die App nutzbar ist. Danach steht
 * die Bestätigung in localStorage (usePrivacyConsent) und der Screen
 * erscheint auf diesem Gerät nicht erneut.
 */
export default function PrivacyOnboarding({ children }: { children: ReactNode }) {
  const { acknowledged, acknowledge } = usePrivacyConsent();
  const t = useT();

  if (acknowledged) return <>{children}</>;

  return (
    <div className="privacy-onboarding">
      <div className="privacy-onboarding-panel">
        <div className="privacy-onboarding-head">
          <Compass size={26} />
          <h1 className="page-title">{t('privacy.onboardingTitle')}</h1>
          <p className="helper-text">{t('privacy.onboardingHint')}</p>
        </div>

        <PrivacyContent />

        <Button type="button" fullWidth onClick={acknowledge}>
          <ShieldCheck size={18} />
          {t('privacy.acknowledge')}
        </Button>
      </div>
    </div>
  );
}
