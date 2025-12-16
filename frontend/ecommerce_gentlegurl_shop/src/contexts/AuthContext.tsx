"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  AccountOverview,
  getAccountOverview,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
} from "../lib/apiClient";

type AuthCustomer = AccountOverview;

type AuthContextValue = {
  customer: AuthCustomer | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    password_confirmation: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
  onLoginSuccess?: () => Promise<void>;
  initialCustomer?: AuthCustomer | null;
};

export function AuthProvider({ children, onLoginSuccess, initialCustomer }: AuthProviderProps) {
  const [customer, setCustomer] = useState<AuthCustomer | null>(initialCustomer ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAccountOverview();
      setCustomer(data);
    } catch {
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        await loginCustomer({ email, password });
        await refreshProfile();
        if (onLoginSuccess) {
          await onLoginSuccess();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onLoginSuccess, refreshProfile],
  );

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      phone: string;
      password: string;
      password_confirmation: string;
    }) => {
      setIsLoading(true);
      try {
        await registerCustomer(payload);
        await loginCustomer({ email: payload.email, password: payload.password });
        await refreshProfile();
        if (onLoginSuccess) {
          await onLoginSuccess();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onLoginSuccess, refreshProfile],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutCustomer();
    } finally {
      setCustomer(null);
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    customer,
    isLoading,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
