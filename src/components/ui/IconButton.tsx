import { ButtonHTMLAttributes } from 'react';
import './IconButton.css';

type IconButtonTone = 'default' | 'danger' | 'accent';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: IconButtonTone;
  /** Pflicht bei icon-only Buttons: dient als aria-label und Tooltip. */
  label: string;
}

export function IconButton({ tone = 'default', label, className, children, ...rest }: IconButtonProps) {
  const classes = ['icon-btn', `icon-btn-${tone}`, className].filter(Boolean).join(' ');
  return (
    <button className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
