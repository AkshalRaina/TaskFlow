'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';

/**
 * Layout for every logged-in page. Sends logged-out visitors to /login.
 * (This only protects the UI. The real protection is the API, which checks every request.)
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <Spinner />;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* The sidebar reads the current URL, which needs a Suspense boundary in this Next.js version. */}
      <Suspense fallback={<div className="bg-slate-900 md:h-screen md:w-60" />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
