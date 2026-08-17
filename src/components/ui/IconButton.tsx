import { ButtonHTMLAttributes, forwardRef } from 'react';
import './IconButton.css';

type IconButtonTone = 'default' | 'danger' | 'accent';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: IconButtonTone;
  label: string; // für aria-label, Pflicht bei icon-only Buttons
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tone = 'default', label, className, children, ...rest }, ref) => {
    const classes = ['icon-btn', `icon-btn-${tone}`, className].filter(Boolean).join(' ');
    return (
      <button ref={ref} className={classes} aria-label={label} title={label} {...rest}>
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
