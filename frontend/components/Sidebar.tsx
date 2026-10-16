'use client';

import { CheckSquare, FolderKanban, LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from './Logo';
import { Avatar } from './ui/Avatar';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
];

/** Left sidebar on desktop, top bar on mobile. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="flex flex-col bg-slate-900 text-slate-300 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
      <div className="flex items-center justify-between px-4 py-4 md:px-5 md:py-6">
        <Logo />
        <button onClick={handleLogout} className="rounded p-2 hover:bg-slate-800 md:hidden" aria-label="Log out">
          <LogOut size={18} />
        </button>
      </div>

      <p className="hidden px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 md:block">Workspace</p>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:px-3 md:pb-0">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-slate-800 p-4 md:block">
        <div className="flex items-center gap-3">
          {user && <Avatar user={user} size="md" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
