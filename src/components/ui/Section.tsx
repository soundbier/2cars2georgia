import { HTMLAttributes, ReactNode } from 'react';
import './Section.css';

interface SectionProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: ReactNode;
  flush?: boolean; // ohne Innenabstand, z.B. für Formulare mit eigenem Layout
}

/**
 * Section ist der einzige "Card"-Baustein der App.
 * Bewusst sparsam einsetzen: nur wenn Inhalte tatsächlich gruppiert werden müssen.
 */
export function Section({ title, action, flush, className, children, ...rest }: SectionProps) {
  return (
    <div className={['section', flush ? 'section-flush' : '', className].filter(Boolean).join(' ')} {...rest}>
      {(title || action) && (
        <div className="section-head">
          {title && <h3 className="section-title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
