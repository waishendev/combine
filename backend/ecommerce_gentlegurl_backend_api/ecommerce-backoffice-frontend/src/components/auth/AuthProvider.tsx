'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AdminUser, fetchProfile, loginAdmin, logoutAdmin } from '@/lib/auth';

export type AuthContextValue = {
  adminUser: AdminUser | null;
  loading: boolean;
  login: (payload: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshProfile();
  }, []);

  const refreshProfile = async () => {
    try {
      const user = await fetchProfile();
      setAdminUser(user);
    } catch {
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload: { username: string; password: string }) => {
    setLoading(true);
    try {
      const user = await loginAdmin(payload);
      setAdminUser(user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutAdmin();
    setAdminUser(null);
  };

  const value = useMemo(
    () => ({ adminUser, loading, login, logout, refreshProfile }),
    [adminUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
