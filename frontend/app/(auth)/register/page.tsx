'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/Feedback';
import { Input, PasswordInput } from '@/components/ui/FormFields';
import { useAuth } from '@/context/AuthContext';
import { errorMessage, toFieldErrors } from '@/lib/formErrors';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters' });
      return;
    }

    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      // On success the auth layout notices the user and redirects to the dashboard.
      await register(form.name, form.email, form.password);
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(toFieldErrors(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Start organizing your projects in minutes</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorMessage message={error} />}
        <Input label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={fieldErrors.name} required autoComplete="name" />
        <Input label="Email address" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} error={fieldErrors.email} required autoComplete="email" />
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          error={fieldErrors.password}
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
        />
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
