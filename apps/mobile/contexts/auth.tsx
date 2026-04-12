import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, usersApi, setOnSessionExpired, type User, type LoginResult } from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await usersApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => { void logout(); });
    return () => setOnSessionExpired(null);
  }, [logout]);

  // On mount, check if we have a stored token and load the user
  useEffect(() => {
    async function init() {
      const token = await getToken();
      if (token) {
        try {
          const me = await usersApi.me();
          setUser(me);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    }
    void init();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await authApi.login(email, password);
    await setToken(result.accessToken);
    setUser(result.user as User);
    return result;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
