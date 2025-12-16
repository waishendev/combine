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
  resetCartSession,
} from "../lib/apiClient";
import { clearSessionToken, getOrCreateSessionToken, setSessionToken as persistSessionToken } from "../lib/sessionToken";

type Totals = {
  subtotal: string;
  discount_total: string;
  shipping_fee: string;
  grand_total: string;
};

type ShippingSetting = {
  flat_fee?: number;
  label?: string;
  currency?: string;
};

export type CartContextValue = {
  items: CartItem[];
  subtotal: string;
  grandTotal: string;
  discountTotal: string;
  shippingFee: string;
  totalQuantity: number;
  itemCount: number;
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
  shippingMethod: "shipping" | "pickup";
  setShippingMethod: (method: "shipping" | "pickup") => void;
  shippingFlatFee: number;
  shippingLabel?: string;
  resetAfterLogout: () => Promise<void>;
};

type CartProviderProps = {
  children: ReactNode;
  setOnCustomerLogin?: (handler?: () => Promise<void>) => void;
  shippingSetting?: ShippingSetting;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children, setOnCustomerLogin, shippingSetting }: CartProviderProps) {
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
  const [shippingMethod, setShippingMethod] = useState<"shipping" | "pickup">("shipping");
  const [shippingFlatFee, setShippingFlatFee] = useState<number>(Number(shippingSetting?.flat_fee ?? 0));
  const [shippingLabel] = useState<string | undefined>(shippingSetting?.label);
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);

  useEffect(() => {
    const token = getOrCreateSessionToken();
    setSessionToken(token || null);
  }, []);

  const applyCartResponse = useCallback((cart?: CartResponse) => {
    const normalizedItems = (cart?.items ?? []).map((item) => ({
      ...item,
      name: item.name ?? (item as unknown as { product_name?: string }).product_name ?? "",
      product: item.product ??
        ((item as unknown as { product_slug?: string }).product_slug
          ? { slug: (item as unknown as { product_slug?: string }).product_slug }
          : undefined),
      product_image:
        item.product_image_url ??
        item.product_image ??
        (item as unknown as { product_image?: string | null }).product_image ??
        item.product?.images?.find((img) => img.is_main)?.image_path ??
        item.product?.images?.[0]?.image_path,
    }));

    setItems(normalizedItems);
    setVoucherError(null);
    setVoucherMessage(null);
    setAppliedVoucher(null);
    setVoucherDiscount(0);

    if (cart?.session_token) {
      setSessionToken(cart.session_token);
      persistSessionToken(cart.session_token);
    }

    setSelectedItemIds(normalizedItems.map((item) => item.id));
  }, []);

  useEffect(() => {
    setSelectedItemIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const reloadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getCart();
      applyCartResponse(response);
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

  const itemCount = useMemo(() => items.length, [items]);

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

  const subtotalValue = useMemo(
    () => Number(selectedItems.reduce((sum, item) => sum + Number(item.line_total), 0)),
    [selectedItems],
  );

  const shippingFeeValue = useMemo(
    () =>
      selectedItems.length === 0
        ? 0
        : shippingMethod === "shipping"
          ? Number(shippingFlatFee)
          : 0,
    [selectedItems.length, shippingFlatFee, shippingMethod],
  );

  const discountValue = useMemo(
    () => Math.min(voucherDiscount, subtotalValue),
    [subtotalValue, voucherDiscount],
  );

  const grandTotalValue = useMemo(
    () => Math.max(subtotalValue - discountValue + shippingFeeValue, 0),
    [discountValue, shippingFeeValue, subtotalValue],
  );

  const selectedGrandTotal = grandTotalValue.toFixed(2);

  useEffect(() => {
    const updatedTotals: Totals = {
      subtotal: subtotalValue.toFixed(2),
      discount_total: discountValue.toFixed(2),
      shipping_fee: shippingFeeValue.toFixed(2),
      grand_total: grandTotalValue.toFixed(2),
    };

    setTotals(updatedTotals);
    setSubtotal(updatedTotals.subtotal);
    setGrandTotal(updatedTotals.grand_total);
    setDiscountTotal(updatedTotals.discount_total);
    setShippingFee(updatedTotals.shipping_fee);
  }, [discountValue, grandTotalValue, shippingFeeValue, subtotalValue]);

  useEffect(() => {
    if (selectedItems.length === 0) {
      setAppliedVoucher(null);
      setVoucherDiscount(0);
      setVoucherMessage(null);
      setVoucherError(null);
    }
  }, [selectedItems.length]);

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
        if (selectedItems.length === 0) {
          setVoucherError("Select items to apply voucher.");
          return;
        }

        const response = await previewCheckout({
          items: selectedItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
          voucher_code: voucherCode || undefined,
          shipping_method: shippingMethod,
        });

        if (shippingMethod === "shipping") {
          setShippingFlatFee(Number(response.shipping_fee ?? shippingFlatFee));
        }

        const hasVoucher = !!response.voucher_valid && !!response.voucher && !response.voucher_error;
        const discountAmount = hasVoucher ? Number(response.discount_total ?? 0) : 0;

        setVoucherDiscount(discountAmount);
        setVoucherError(response.voucher_error ?? null);
        setAppliedVoucher(hasVoucher ? response.voucher : null);
        setVoucherMessage(
          hasVoucher
            ? `Voucher ${response.voucher?.code} applied.`
            : response.voucher_message ?? response.voucher_error ?? null,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to apply voucher.";
        setVoucherError(message);
        setAppliedVoucher(null);
        setVoucherDiscount(0);
        setVoucherMessage(null);
      } finally {
        setIsApplyingVoucher(false);
      }
    },
    [selectedItems, shippingMethod, shippingFlatFee],
  );

  const removeVoucher = useCallback(async () => {
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherError(null);
    setVoucherMessage(null);
  }, []);

  const clearVoucherFeedback = useCallback(() => {
    setVoucherError(null);
    setVoucherMessage(null);
  }, []);

  const resetAfterLogout = useCallback(async () => {
    try {
      const response = await resetCartSession();
      applyCartResponse(response);
      setSessionToken(response.session_token ?? null);
      persistSessionToken(response.session_token ?? null);
    } catch {
      setItems([]);
      setSelectedItemIds([]);
      setAppliedVoucher(null);
      setVoucherDiscount(0);
      setVoucherError(null);
      setVoucherMessage(null);
      setSessionToken(null);
      clearSessionToken();
    }
  }, [applyCartResponse]);

  const value: CartContextValue = {
    items,
    subtotal,
    grandTotal,
    discountTotal,
    shippingFee,
    totalQuantity,
    itemCount,
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
    shippingMethod,
    setShippingMethod,
    shippingFlatFee,
    shippingLabel,
    resetAfterLogout,
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
