'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, setAccessToken, setOnSessionExpired, type User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      setAccessToken(accessToken);
      const me = await usersApi.me();
      setUser(me);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password);
    setAccessToken(accessToken);
    const me = await usersApi.me();
    setUser(me);
  };

  const register = async (email: string, password: string, name?: string) => {
    const { accessToken } = await authApi.register(email, password, name);
    setAccessToken(accessToken);
    const me = await usersApi.me();
    setUser(me);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const me = await usersApi.me();
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
