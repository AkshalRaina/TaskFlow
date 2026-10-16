'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

type FieldWrapperProps = { label: string; error?: string; children: ReactNode };

function Field({ label, error, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export function Input({ label, error, ...props }: InputProps) {
  return (
    <Field label={label} error={error}>
      <input className={fieldClass} {...props} />
    </Field>
  );
}

/** A password field with an eye button to show/hide what you typed. */
export function PasswordInput({ label, error, ...props }: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input type={visible ? 'text' : 'password'} className={`${fieldClass} pr-10`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export function Textarea({ label, error, ...props }: TextareaProps) {
  return (
    <Field label={label} error={error}>
      <textarea className={fieldClass} rows={3} {...props} />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string };

/** A select with an optional label (filters use it without one). */
export function Select({ label, error, className = '', ...props }: SelectProps) {
  const select = <select className={`${fieldClass} ${className}`} {...props} />;
  return label ? (
    <Field label={label} error={error}>
      {select}
    </Field>
  ) : (
    select
  );
}
