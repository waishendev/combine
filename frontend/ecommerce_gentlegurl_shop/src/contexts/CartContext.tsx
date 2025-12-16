"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CartItem,
  CartResponse,
  CheckoutPreviewResponse,
  addOrUpdateCartItem,
  getCart,
  mergeCart,
  previewCheckout,
  removeCartItem,
} from "../lib/apiClient";
import { getOrCreateSessionToken } from "../lib/sessionToken";

type Totals = {
  subtotal: string;
  discount_total: string;
  shipping_fee: string;
  grand_total: string;
};

export type CartContextValue = {
  items: CartItem[];
  subtotal: string;
  grandTotal: string;
  discountTotal: string;
  shippingFee: string;
  totalQuantity: number;
  isLoading: boolean;
  isApplyingVoucher: boolean;
  sessionToken: string | null;
  selectedItems: CartItem[];
  selectedItemIds: number[];
  selectedSubtotal: string;
  selectedGrandTotal: string;
  totals: Totals;
  appliedVoucher: CheckoutPreviewResponse["voucher"] | null;
  voucherError: string | null;
  voucherMessage: string | null;
  reloadCart: () => Promise<void>;
  addToCart: (productId: number, quantity: number) => Promise<void>;
  updateItemQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  onCustomerLogin: () => Promise<void>;
  applyVoucher: (voucherCode?: string | null) => Promise<void>;
  removeVoucher: () => Promise<void>;
  clearVoucherFeedback: () => void;
  toggleSelectItem: (itemId: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
};

type CartProviderProps = {
  children: ReactNode;
  setOnCustomerLogin?: (handler?: () => Promise<void>) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children, setOnCustomerLogin }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState<string>("0");
  const [grandTotal, setGrandTotal] = useState<string>("0");
  const [discountTotal, setDiscountTotal] = useState<string>("0");
  const [shippingFee, setShippingFee] = useState<string>("0");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [totals, setTotals] = useState<Totals>({
    subtotal: "0",
    discount_total: "0",
    shipping_fee: "0",
    grand_total: "0",
  });
  const [appliedVoucher, setAppliedVoucher] = useState<CheckoutPreviewResponse["voucher"] | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getOrCreateSessionToken();
    setSessionToken(token || null);
  }, []);

  const applyTotals = useCallback((data?: Partial<Totals>) => {
    const updatedTotals: Totals = {
      subtotal: data?.subtotal ?? "0",
      discount_total: data?.discount_total ?? "0",
      shipping_fee: data?.shipping_fee ?? "0",
      grand_total: data?.grand_total ?? "0",
    };

    setTotals(updatedTotals);
    setSubtotal(updatedTotals.subtotal);
    setGrandTotal(updatedTotals.grand_total);
    setDiscountTotal(updatedTotals.discount_total);
    setShippingFee(updatedTotals.shipping_fee);
  }, []);

  const applyCartResponse = useCallback(
    (cart?: CartResponse) => {
      setItems(cart?.items ?? []);
      applyTotals(cart);
      setVoucherError(null);
    },
    [applyTotals],
  );

  useEffect(() => {
    setSelectedItemIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const reloadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getCart();
      applyCartResponse(response);
      setSelectedItemIds([]);
    } catch {
      applyCartResponse();
    } finally {
      setIsLoading(false);
    }
  }, [applyCartResponse]);

  useEffect(() => {
    reloadCart();
  }, [reloadCart]);

  const addToCart = useCallback(
    async (productId: number, quantity: number) => {
      setIsLoading(true);
      try {
        const response = await addOrUpdateCartItem({ product_id: productId, quantity });
        applyCartResponse(response);
      } finally {
        setIsLoading(false);
      }
    },
    [applyCartResponse],
  );

  const updateItemQuantity = useCallback(
    async (itemId: number, quantity: number) => {
      setIsLoading(true);
      try {
        let productId = items.find((item) => item.id === itemId)?.product_id;
        if (!productId) {
          const cart = await getCart();
          applyCartResponse(cart);
          productId = cart.items.find((item) => item.id === itemId)?.product_id;
        }

        if (!productId) {
          throw new Error("Cart item not found");
        }

        const response = await addOrUpdateCartItem({ product_id: productId, quantity });
        applyCartResponse(response);
      } finally {
        setIsLoading(false);
      }
    },
    [applyCartResponse, items],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      setIsLoading(true);
      try {
        const response = await removeCartItem(itemId);
        applyCartResponse(response);
      } finally {
        setIsLoading(false);
      }
    },
    [applyCartResponse],
  );

  const onCustomerLogin = useCallback(async () => {
    try {
      const sessionToken = getOrCreateSessionToken();
      setSessionToken(sessionToken || null);
      await mergeCart({ session_token: sessionToken });
    } catch {
      // merge might not exist; ignore
    } finally {
      await reloadCart();
    }
  }, [reloadCart]);

  useEffect(() => {
    if (setOnCustomerLogin) {
      setOnCustomerLogin(onCustomerLogin);
      return () => setOnCustomerLogin(undefined);
    }
  }, [onCustomerLogin, setOnCustomerLogin]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds],
  );

  const selectedSubtotal = useMemo(
    () =>
      selectedItems
        .reduce((sum, item) => sum + Number(item.line_total), 0)
        .toFixed(2),
    [selectedItems],
  );

  const selectedGrandTotal = selectedSubtotal;

  const toggleSelectItem = useCallback((itemId: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItemIds(items.map((item) => item.id));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  const applyVoucher = useCallback(
    async (voucherCode?: string | null) => {
      setIsApplyingVoucher(true);
      setVoucherError(null);
      setVoucherMessage(null);

      try {
        if (!items.length) {
          setVoucherError("No items in cart to apply voucher.");
          return;
        }

        const response = await previewCheckout({
          items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
          voucher_code: voucherCode || undefined,
          shipping_method: "shipping",
          // store_location_id: null,
          // shipping_postcode: null,
        });

        applyTotals({
          subtotal: String(response.subtotal),
          discount_total: String(response.discount_total),
          shipping_fee: String(response.shipping_fee),
          grand_total: String(response.grand_total),
        });

        const hasVoucher = !!response.voucher && !response.voucher_error;
        setVoucherError(response.voucher_error ?? null);
        setAppliedVoucher(hasVoucher ? response.voucher : null);
        setVoucherMessage(hasVoucher ? `Voucher ${response.voucher?.code} applied.` : null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to apply voucher.";
        setVoucherError(message);
        setAppliedVoucher(null);
        setVoucherMessage(null);
      } finally {
        setIsApplyingVoucher(false);
      }
    },
    [applyTotals, items],
  );

  const removeVoucher = useCallback(async () => {
    setAppliedVoucher(null);
    setVoucherError(null);
    setVoucherMessage(null);
    await applyVoucher();
  }, [applyVoucher]);

  const clearVoucherFeedback = useCallback(() => {
    setVoucherError(null);
    setVoucherMessage(null);
  }, []);

  const value: CartContextValue = {
    items,
    subtotal,
    grandTotal,
    discountTotal,
    shippingFee,
    totalQuantity,
    isLoading,
    isApplyingVoucher,
    sessionToken,
    selectedItems,
    selectedItemIds,
    selectedSubtotal,
    selectedGrandTotal,
    totals,
    appliedVoucher,
    voucherError,
    voucherMessage,
    reloadCart,
    addToCart,
    updateItemQuantity,
    removeItem,
    onCustomerLogin,
    applyVoucher,
    removeVoucher,
    clearVoucherFeedback,
    toggleSelectItem,
    selectAll,
    clearSelection,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
