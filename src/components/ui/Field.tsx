import { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import './Field.css';

interface FieldWrapProps {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function FieldWrap({ label, htmlFor, children }: FieldWrapProps) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className, ...rest }: InputProps) {
  const input = <input id={id} className={['field-control', className].filter(Boolean).join(' ')} {...rest} />;
  return label ? (
    <FieldWrap label={label} htmlFor={id}>
      {input}
    </FieldWrap>
  ) : (
    input
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, id, className, children, ...rest }: SelectProps) {
  const select = (
    <select id={id} className={['field-control', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
  return label ? (
    <FieldWrap label={label} htmlFor={id}>
      {select}
    </FieldWrap>
  ) : (
    select
  );
}
