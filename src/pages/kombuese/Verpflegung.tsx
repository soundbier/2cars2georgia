import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, UtensilsCrossed, ShoppingCart, Package } from 'lucide-react';
import { useT } from '../../i18n';
import { PageHeader, Section } from '../../components/ui';
import '../Settings.css';

function SettingLink({
  to,
  icon,
  label,
  value
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link to={to} className="setting-row setting-link">
      <span className="setting-link-icon">{icon}</span>
      <div className="setting-row-body">
        <div className="setting-row-label">{label}</div>
        <div className="helper-text">{value}</div>
      </div>
      <ChevronRight size={18} className="setting-link-chevron" />
    </Link>
  );
}

/**
 * Übersichtsseite der Kombüse: bündelt die vier bestehenden Bereiche
 * Speiseplan, Gerichte, Einkaufsliste und Lager, erreichbar über das
 * "Mehr"-Dropup der Bottom-Navigation.
 */
export default function Verpflegung() {
  const t = useT();

  return (
    <div className="settings-page">
      <PageHeader title={t('kombuese.sectionTitle')} subtitle={t('kombuese.overviewSubtitle')} />

      <Section title={t('kombuese.sectionTitle')}>
        <div className="settings-list">
          <SettingLink
            to="/settings/verpflegung/speiseplan"
            icon={<CalendarDays size={18} strokeWidth={1.75} />}
            label={t('kombuese.mealPlan')}
            value={t('kombuese.mealPlanValue')}
          />
          <SettingLink
            to="/settings/verpflegung/gerichte"
            icon={<UtensilsCrossed size={18} strokeWidth={1.75} />}
            label={t('kombuese.dishes')}
            value={t('kombuese.dishesValue')}
          />
          <SettingLink
            to="/settings/verpflegung/einkaufsliste"
            icon={<ShoppingCart size={18} strokeWidth={1.75} />}
            label={t('kombuese.shoppingList')}
            value={t('kombuese.shoppingListValue')}
          />
          <SettingLink
            to="/settings/verpflegung/lager"
            icon={<Package size={18} strokeWidth={1.75} />}
            label={t('kombuese.inventory')}
            value={t('kombuese.inventoryValue')}
          />
        </div>
      </Section>
    </div>
  );
}
