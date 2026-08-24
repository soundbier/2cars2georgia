import { Link, useLocation } from 'react-router-dom';
import { TranslationKey, useT } from '../i18n';
// Dieselbe Anmutung wie der Umschalter im Cockpit – hier nur mit Links
// statt Knöpfen, weil jeder Bereich seine eigene Adresse hat.
import './ui/SegmentedControl.css';
import './SettingsSectionNav.css';

/** Die beiden Bereiche außerhalb der Bottom-Navigation, von allgemein nach speziell. */
const SECTIONS: { to: string; labelKey: TranslationKey }[] = [
  { to: '/settings', labelKey: 'settingsNav.general' },
  { to: '/settings/routenplaner', labelKey: 'settingsNav.routes' }
];

/**
 * Umschalter zwischen Einstellungen und Routen.
 *
 * Beide Seiten gehören zusammen – man vergleicht sie, statt sie nacheinander
 * abzuarbeiten – lagen aber jeweils hinter dem „Mehr"-Dropup: Wer von den
 * Routen in die Einstellungen wollte, musste erst wieder zurück. Der
 * Umschalter steht deshalb auf beiden an derselben Stelle, direkt unter dem
 * Titel.
 *
 * Bewusst echte Links: Jeder Bereich behält seine eigene Adresse, damit
 * Zurück und Neuladen dort landen, wo man war, und ein Ziel wie „Routen"
 * auch von anderswo verlinkbar bleibt.
 */
export function SettingsSectionNav() {
  const { pathname } = useLocation();
  const t = useT();

  return (
    <nav className="segmented settings-section-nav" aria-label={t('settingsNav.label')}>
      {SECTIONS.map((section) => {
        // Genauer Vergleich: /settings ist sonst auch auf allen Unterseiten aktiv.
        const active = pathname === section.to;
        return (
          <Link
            key={section.to}
            to={section.to}
            aria-current={active ? 'page' : undefined}
            className={`segmented-option ${active ? 'segmented-option-active' : ''}`}
          >
            {t(section.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
