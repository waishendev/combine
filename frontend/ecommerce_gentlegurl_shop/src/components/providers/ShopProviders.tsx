"use client";

import { ReactNode, useCallback, useState } from "react";
import { AuthProvider } from "../../contexts/AuthContext";
import { CartProvider } from "../../contexts/CartContext";
import { Customer } from "@/lib/apiClient";
import { HomepageSettings } from "@/lib/server/getHomepage";

type ShopProvidersProps = {
  children: ReactNode;
  initialCustomer?: Customer | null;
  shippingSetting?: HomepageSettings["shipping"];
};

export function ShopProviders({ children, initialCustomer, shippingSetting }: ShopProvidersProps) {
  const [onCustomerLogin, setOnCustomerLogin] = useState<(() => Promise<void>) | undefined>();

  const handleSetOnCustomerLogin = useCallback((handler?: () => Promise<void>) => {
    setOnCustomerLogin(() => handler);
  }, []);

  return (
    <AuthProvider onLoginSuccess={onCustomerLogin} initialCustomer={initialCustomer}>
      <CartProvider
        setOnCustomerLogin={handleSetOnCustomerLogin}
        shippingSetting={shippingSetting}
      >
        {children}
      </CartProvider>
    </AuthProvider>
  );
}
