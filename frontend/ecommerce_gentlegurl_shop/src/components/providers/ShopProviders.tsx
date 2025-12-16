"use client";

import { ReactNode, useCallback, useState } from "react";
import { AuthProvider } from "../../contexts/AuthContext";
import { CartProvider } from "../../contexts/CartContext";
import { Customer } from "@/lib/apiClient";

type ShopProvidersProps = {
  children: ReactNode;
  initialCustomer?: Customer | null;
};

export function ShopProviders({ children, initialCustomer }: ShopProvidersProps) {
  const [onCustomerLogin, setOnCustomerLogin] = useState<(() => Promise<void>) | undefined>();

  const handleSetOnCustomerLogin = useCallback((handler?: () => Promise<void>) => {
    setOnCustomerLogin(() => handler);
  }, []);

  return (
    <AuthProvider onLoginSuccess={onCustomerLogin} initialCustomer={initialCustomer}>
      <CartProvider setOnCustomerLogin={handleSetOnCustomerLogin}>{children}</CartProvider>
    </AuthProvider>
  );
}
