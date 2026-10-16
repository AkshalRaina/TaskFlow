'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/Feedback';
import { Input, PasswordInput } from '@/components/ui/FormFields';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/formErrors';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // On success the auth layout notices the user and redirects to the dashboard.
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Sign in to your TaskFlow account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorMessage message={error} />}
        <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" required autoComplete="email" />
        <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <Button type="submit" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          Create account
        </Link>
      </p>
    </>
  );
}
