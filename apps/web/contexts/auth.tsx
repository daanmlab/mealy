'use client';

import { createContext, useContext, useEffect, useCallback, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import { authApi, usersApi, setOnSessionExpired, type User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthConsumer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      router.push('/login');
    });
    return () => setOnSessionExpired(null);
  }, [router]);

  // Fetch the full user profile whenever the session becomes authenticated.
  useEffect(() => {
    if (status === 'authenticated' && !user) {
      usersApi.me().then(setUser).catch(() => setUser(null));
    } else if (status === 'unauthenticated') {
      setUser(null);
    }
  }, [status, user]);

  const loading = status === 'loading' || (status === 'authenticated' && !user);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn('credentials', { email, password, redirect: false });
    if (!result || result.error) throw new Error(result?.error ?? 'Login failed');
    const me = await usersApi.me();
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    await authApi.register(email, password, name);
    const result = await signIn('credentials', { email, password, redirect: false });
    if (!result || result.error) throw new Error(result?.error ?? 'Sign in after register failed');
    const me = await usersApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await signOut({ redirectTo: '/login' });
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await usersApi.me();
    setUser(me);
  }, []);

  // Keep TypeScript happy — session is used indirectly via status.
  void session;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthConsumer>{children}</AuthConsumer>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
