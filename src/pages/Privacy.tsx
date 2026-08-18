import { useI18n, useT } from '../i18n';
import { PageHeader, Section } from '../components/ui';
import './Settings.css';
import './Privacy.css';

/**
 * Reiner Inhalt ohne Navigations-Chrome, damit er sowohl innerhalb des
 * Routers (Privacy, Standard-Export unten) als auch im router-losen
 * RoadtripGate (dort als einfaches Overlay, siehe RoadtripGate.tsx)
 * verwendet werden kann.
 */
export function PrivacyContent() {
  const t = useT();
  const { language } = useI18n();
  const translationNote = t('privacy.translationNote');

  return (
    <div className="privacy-content">
      <p className="helper-text privacy-intro">{t('privacy.intro')}</p>

      {/* Nur in übersetzten Fassungen sichtbar: Die deutsche Fassung ist die
          rechtlich maßgebliche, siehe Datenschutz-Abschnitt README. */}
      {translationNote && language !== 'de' && (
        <p className="helper-text privacy-placeholder">{translationNote}</p>
      )}

      <Section title={t('privacy.controller')}>
        <p className="helper-text privacy-placeholder">{t('privacy.controllerPlaceholder')}</p>
      </Section>

      <Section title={t('privacy.dataTitle')}>
        <ul className="privacy-list">
          <li>
            <strong>{t('privacy.dataGps')}</strong> {t('privacy.dataGpsText')}
          </li>
          <li>
            <strong>{t('privacy.dataLog')}</strong> {t('privacy.dataLogText')}
          </li>
          <li>
            <strong>{t('privacy.dataCosts')}</strong> {t('privacy.dataCostsText')}
          </li>
          <li>
            <strong>{t('privacy.dataNames')}</strong> {t('privacy.dataNamesText')}
          </li>
          <li>
            <strong>{t('privacy.dataLocal')}</strong> {t('privacy.dataLocalText')}
          </li>
        </ul>
      </Section>

      <Section title={t('privacy.purposeTitle')}>
        <p className="helper-text">{t('privacy.purposeText')}</p>
      </Section>

      <Section title={t('privacy.processorsTitle')}>
        <p className="helper-text">{t('privacy.processorsText')}</p>
      </Section>

      <Section title={t('privacy.retentionTitle')}>
        <p className="helper-text">{t('privacy.retentionText')}</p>
        <p className="helper-text">{t('privacy.retentionTrashText')}</p>
      </Section>

      <Section title={t('privacy.exportTitle')}>
        <p className="helper-text">{t('privacy.exportText')}</p>
      </Section>

      <Section title={t('privacy.rightsTitle')}>
        <p className="helper-text">{t('privacy.rightsText')}</p>
      </Section>
    </div>
  );
}

/** Innerhalb des Routers verwendete Variante mit Zurück-Navigation, siehe App.tsx. */
export default function Privacy() {
  const t = useT();

  return (
    <div className="settings-page">
      <PageHeader title={t('privacy.title')} subtitle={t('privacy.subtitle')} backTo="/settings" />
      <PrivacyContent />
    </div>
  );
}
