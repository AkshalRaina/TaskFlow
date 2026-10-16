'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';

/** Layout for /login and /register. Logged-in users are sent to the dashboard. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || user) {
    return <Spinner />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white md:flex">
          <Logo />
          <div>
            <h2 className="text-3xl font-bold">Get things done, together.</h2>
            <p className="mt-3 text-slate-300">A simple workspace to manage projects, tasks and progress.</p>
          </div>
          <p className="text-xs text-slate-500">© TaskFlow</p>
        </div>
        <div className="p-8 sm:p-10">
          <div className="mb-6 md:hidden">
            <Logo className="text-slate-900" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
