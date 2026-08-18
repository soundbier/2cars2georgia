import { ReactNode } from 'react';
import './Badge.css';

type BadgeTone = 'neutral' | 'success' | 'danger';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', children, dot }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
