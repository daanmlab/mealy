'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, setAccessToken, setOnSessionExpired, type User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Set to true when loginWithToken is called so loadUser doesn't overwrite.
  const externalAuth = useRef(false);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setAccessToken(null);
      router.push('/login');
    });
    return () => setOnSessionExpired(null);
  }, [router]);

  const loadUser = useCallback(async () => {
    try {
      const { accessToken } = await authApi.refresh();
      if (externalAuth.current) return; // OAuth callback already handled auth
      setAccessToken(accessToken);
      const me = await usersApi.me();
      if (externalAuth.current) return;
      setUser(me);
    } catch {
      if (!externalAuth.current) {
        setUser(null);
        setAccessToken(null);
      }
    } finally {
      if (!externalAuth.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password);
    setAccessToken(accessToken);
    const me = await usersApi.me();
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { accessToken } = await authApi.register(email, password, name);
    setAccessToken(accessToken);
    const me = await usersApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await usersApi.me();
    setUser(me);
  }, []);

  const loginWithToken = useCallback(async (token: string): Promise<User> => {
    externalAuth.current = true;
    setAccessToken(token);
    const me = await usersApi.me();
    setUser(me);
    setLoading(false);
    return me;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
