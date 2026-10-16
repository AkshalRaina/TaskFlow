'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '@/lib/api';
import type { JoinedProject, User } from '@/lib/types';

type AuthContextValue = {
  user: User | null;
  /** True until we know whether the visitor is logged in. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** With an `inviteToken`, the new account also joins the invited project (returned as `joinedProject`). */
  register: (name: string, email: string, password: string, inviteToken?: string) => Promise<JoinedProject | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the API who we are (the session lives in an httpOnly cookie we can't read).
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // If any request later comes back 401 (e.g. the session expired), treat the user as logged out.
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api<User>('/auth/login', { method: 'POST', body: { email, password } }));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, inviteToken?: string) => {
    const { joinedProject, ...newUser } = await api<User & { joinedProject: JoinedProject | null }>('/auth/register', {
      method: 'POST',
      body: { name, email, password, inviteToken },
    });
    setUser(newUser);
    return joinedProject;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
