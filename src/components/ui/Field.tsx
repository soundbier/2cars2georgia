import { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import './Field.css';

const controlClass = (className?: string) => ['field-control', className].filter(Boolean).join(' ');

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={controlClass(className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={controlClass(className)} {...rest}>
      {children}
    </select>
  );
}
