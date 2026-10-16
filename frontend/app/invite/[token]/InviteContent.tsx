'use client';

import { CircleCheckBig, Clock, MailWarning } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/components/ui/Display';
import { ErrorMessage, Spinner } from '@/components/ui/Feedback';
import { Input, PasswordInput } from '@/components/ui/FormFields';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import { errorMessage, toFieldErrors } from '@/lib/formErrors';
import type { InvitationInfo, JoinedProject } from '@/lib/types';

/**
 * What you see after clicking an invitation link:
 *   - new to TaskFlow       -> sign up (email is fixed to the invited one) and join in one step
 *   - already have account  -> sign in, then join
 *   - already signed in     -> one click to join
 *   - expired / used link   -> explains what happened
 */
export function InviteContent() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, logout } = useAuth();
  const invite = useApi<InvitationInfo>(`/invitations/${token}`);
  const [joined, setJoined] = useState<{ result: JoinedProject; newAccount: boolean } | null>(null);

  async function accept(newAccount = false) {
    const result = await api<JoinedProject>(`/invitations/${token}/accept`, { method: 'POST' });
    setJoined({ result, newAccount });
  }

  let content: ReactNode;
  if (invite.error) {
    content = (
      <Problem icon={<MailWarning size={40} />} title="Invitation not found" text={invite.error} />
    );
  } else if (!invite.data || authLoading) {
    content = <Spinner />;
  } else if (invite.data.status === 'expired') {
    content = (
      <Problem
        icon={<Clock size={40} />}
        title="This invitation has expired"
        text={`Invitation links work for 24 hours. Ask ${invite.data.invitedBy} to send you a new one.`}
      />
    );
  } else if (invite.data.status === 'accepted' && !joined) {
    content = (
      <Problem
        icon={<CircleCheckBig size={40} />}
        title="This invitation has already been used"
        text="If you joined already, the project is in your projects list."
      />
    );
  } else {
    const info = invite.data;
    content = (
      <>
        <h1 className="text-2xl font-bold text-slate-900">You&apos;re invited!</h1>
        <p className="mt-2 text-slate-600">
          <strong>{info.invitedBy}</strong> invited you to join <strong>{info.project.name}</strong> as{' '}
          <RoleBadge role={info.role} />
        </p>

        <div className="mt-6">
          {user && user.email === info.email ? (
            <AcceptButton onAccept={() => accept()} />
          ) : user ? (
            <div className="space-y-3">
              <ErrorMessage message={`This invitation is for ${info.email}, but you're signed in as ${user.email}.`} />
              <Button variant="secondary" onClick={logout}>
                Sign out and continue
              </Button>
            </div>
          ) : info.accountExists ? (
            <SignInAndJoin email={info.email} onJoined={() => accept()} />
          ) : (
            <RegisterAndJoin email={info.email} token={token} onJoined={(result) => setJoined({ result, newAccount: true })} />
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <Logo className="text-slate-900" />
        </div>
        {content}
      </div>
      {joined && <JoinedModal {...joined} />}
    </div>
  );
}

function Problem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mb-3 flex justify-center text-slate-400">{icon}</div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline">
        Go to TaskFlow →
      </Link>
    </div>
  );
}

function AcceptButton({ onAccept }: { onAccept: () => Promise<void> }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setWorking(true);
    setError('');
    try {
      await onAccept();
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorMessage message={error} />}
      <Button onClick={handleClick} loading={working} className="w-full">
        Accept and join
      </Button>
    </div>
  );
}

function SignInAndJoin({ email, onJoined }: { email: string; onJoined: () => Promise<void> }) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      await login(email, password);
      await onJoined();
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">You already have a TaskFlow account. Sign in to join.</p>
      {error && <ErrorMessage message={error} />}
      <Input label="Email address" type="email" value={email} readOnly disabled />
      <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus autoComplete="current-password" />
      <Button type="submit" loading={working} className="w-full">
        Sign in and join
      </Button>
    </form>
  );
}

function RegisterAndJoin({ email, token, onJoined }: { email: string; token: string; onJoined: (result: JoinedProject) => void }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters' });
      return;
    }
    setWorking(true);
    setError('');
    setFieldErrors({});
    try {
      // Creates the account and joins the project in one request.
      const joined = await register(name, email, password, token);
      if (joined) onJoined(joined);
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(toFieldErrors(err));
      setWorking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">Create your account to join.</p>
      {error && <ErrorMessage message={error} />}
      <Input label="Email address" type="email" value={email} readOnly disabled />
      <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} required autoFocus autoComplete="name" />
      <PasswordInput
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        placeholder="At least 8 characters"
        required
        autoComplete="new-password"
      />
      <Button type="submit" loading={working} className="w-full">
        Create account and join
      </Button>
    </form>
  );
}

/** The success popup after joining. */
function JoinedModal({ result, newAccount }: { result: JoinedProject; newAccount: boolean }) {
  const router = useRouter();
  const openProject = () => router.push(`/projects/${result.project.id}`);

  return (
    <Modal title={newAccount ? 'Registration successful' : 'Invitation accepted'} onClose={openProject}>
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CircleCheckBig size={36} />
          </span>
        </div>
        <p className="text-lg font-semibold text-slate-900">{newAccount ? 'Welcome to TaskFlow! 🎉' : "You're in! 🎉"}</p>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve joined <strong>{result.project.name}</strong> as {ROLE_LABELS[result.role].toLowerCase()}.
        </p>
        <Button onClick={openProject} className="mt-6 w-full">
          Open project
        </Button>
      </div>
    </Modal>
  );
}
