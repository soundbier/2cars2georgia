import { ReactNode } from 'react';
import './Section.css';

interface SectionProps {
  title?: string;
  children: ReactNode;
}

/**
 * Section ist der einzige "Card"-Baustein der App.
 * Bewusst sparsam einsetzen: nur wenn Inhalte tatsächlich gruppiert werden müssen.
 */
export function Section({ title, children }: SectionProps) {
  return (
    <div className="section">
      {title && <h2 className="section-title section-head">{title}</h2>}
      {children}
    </div>
  );
}
