import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Zeigt eine Zurück-Zeile über dem Titel (für Unterseiten). */
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Zurück' }: PageHeaderProps) {
  return (
    <div className="page-header">
      {backTo && (
        <Link to={backTo} className="page-header-back">
          <ChevronLeft size={16} />
          <span>{backLabel}</span>
        </Link>
      )}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="helper-text">{subtitle}</p>}
    </div>
  );
}
