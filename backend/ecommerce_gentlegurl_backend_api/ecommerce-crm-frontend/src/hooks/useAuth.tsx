"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  customerLogout,
  customerRegister,
  fetchCustomerProfile,
  type CustomerAuthUser,
} from "@/lib/auth";
import { useCart } from "@/hooks/useCart";
import { loginCustomer } from "@/hooks/useCustomerAuth";

type AuthContextValue = {
  user: CustomerAuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { reload: reloadCart } = useCart({ autoLoad: false });

  useEffect(() => {
    fetchCustomerProfile()
      .then((res) => {
        setUser(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const customer = await loginCustomer(email, password);
      setUser(customer);
      await reloadCart().catch((error) => console.error("Reload cart after login failed", error));
    } finally {
      setLoading(false);
    }
  }, [reloadCart]);

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      password_confirmation: string;
      phone?: string;
    }) => {
      setLoading(true);
      try {
        const res = await customerRegister(payload);
        setUser(res.data);
        await reloadCart().catch((error) => console.error("Reload cart after register failed", error));
      } finally {
        setLoading(false);
      }
    },
    [reloadCart],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await customerLogout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

