"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { getOrCreateSessionToken } from "@/lib/session-token";
import type { Cart } from "@/lib/shop-types";

export function useCart(options?: { autoLoad?: boolean }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const sessionToken = getOrCreateSessionToken();
  const autoLoad = options?.autoLoad ?? true;

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Cart }>(`/public/shop/cart?session_token=${sessionToken}`);
      setCart(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (autoLoad) {
      void loadCart();
    }
  }, [autoLoad, loadCart]);

  async function addOrUpdateItem(productId: number, quantity: number) {
    const res = await apiPost<{ data: Cart }>(`/public/shop/cart/items`, {
      session_token: sessionToken,
      product_id: productId,
      quantity,
    });
    setCart(res.data);
  }

  async function removeItem(itemId: number) {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/public/shop/cart/items/${itemId}?session_token=${sessionToken}`,
      {
        method: "DELETE",
      },
    );
    await loadCart();
  }

  return {
    cart,
    loading,
    addOrUpdateItem,
    removeItem,
    reload: loadCart,
  };
}
