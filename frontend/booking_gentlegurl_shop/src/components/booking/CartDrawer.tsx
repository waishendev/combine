"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkoutCart,
  getBookingBankAccounts,
  getBookingCart,
  getBookingPaymentGateways,
  getBillplzPaymentGatewayOptions,
  getMe,
  getServicePackageAvailableFor,
  payBooking,
  payPublicOrder,
  redeemServicePackage,
  releaseBookingCartPackageClaim,
  removeBookingCartItemPhoto,
  removeCartItem,
  removePackageCartItem,
  uploadBookingCartItemPhotos,
  updateBookingPackageCartItemQty,
  type PublicBookingBankAccount,
  type PublicBookingPaymentGateway,
  type BillplzPaymentGatewayOption,
} from "@/lib/apiClient";
import { BookingCart } from "@/lib/types";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

function formatSlotRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateStr = start.toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
  const t1 = start.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const t2 = end.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return { dateStr, timeRange: `${t1} – ${t2}` };
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatDuration(sec: number) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function isPremiumService(serviceType: string | null | undefined): boolean {
  return String(serviceType ?? "").toLowerCase() === "premium";
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const [cart, setCart] = useState<BookingCart | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [billingSameAsContact, setBillingSameAsContact] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [allowNoDepositBooking, setAllowNoDepositBooking] = useState(false);
  const [availableMap, setAvailableMap] = useState<Record<number, number>>({});
  const [gateways, setGateways] = useState<PublicBookingPaymentGateway[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PublicBookingBankAccount[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"manual_transfer" | "billplz_online_banking" | "billplz_credit_card">("manual_transfer");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [onlineBankingOptions, setOnlineBankingOptions] = useState<BillplzPaymentGatewayOption[]>([]);
  const [selectedBillplzGatewayOptionId, setSelectedBillplzGatewayOptionId] = useState<number | null>(null);
  const [packageActionItemId, setPackageActionItemId] = useState<number | null>(null);
  const [packageQtyBusyId, setPackageQtyBusyId] = useState<number | null>(null);
  const [photoBusyItemId, setPhotoBusyItemId] = useState<number | null>(null);

  const loadCart = useCallback(async () => {
    try {
      const data = await getBookingCart();
      setCart(data);
      const itemCount = (data?.items?.length || 0) + (data?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
    } catch {
      setMessage("Unable to load cart.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        void loadCart();
      });
      getMe()
        .then((me) => {
          if (!me) {
            setIsLoggedIn(false);
            setCustomerId(null);
            return;
          }
          setIsLoggedIn(true);
          setCustomerId(me.id);
          setAllowNoDepositBooking(Boolean(me.allow_booking_without_deposit));
          setGuestName((prev) => prev || me.name || "");
          setGuestPhone((prev) => prev || me.phone || "");
          setGuestEmail((prev) => prev || me.email || "");
        })
        .catch(() => {
          setIsLoggedIn(false);
          setCustomerId(null);
          setAllowNoDepositBooking(false);
        });

      Promise.all([
        getBookingPaymentGateways(),
        getBookingBankAccounts(),
        getBillplzPaymentGatewayOptions({ type: "booking", gateway_group: "online_banking" }),
        getBillplzPaymentGatewayOptions({ type: "booking", gateway_group: "credit_card" }),
      ])
        .then(([gatewayData, bankData, onlineOptions, cardOptions]) => {
          const activeGateways = gatewayData.filter((g) => g.is_active !== false);
          const normalizedGateways = activeGateways
            .map((gateway) => ({
              ...gateway,
              key: gateway.key === "billplz_fpx" ? "billplz_online_banking" : gateway.key === "billplz_card" ? "billplz_credit_card" : gateway.key,
            }));
          if (process.env.NODE_ENV !== "production") {
            console.info("[Booking CartDrawer] payment gateways response:", gatewayData);
            console.info("[Booking CartDrawer] billplz online options response:", onlineOptions);
            console.info("[Booking CartDrawer] billplz credit options response:", cardOptions);
            console.info("[Booking CartDrawer] payment gateways after normalization:", normalizedGateways);
          }
          setGateways(normalizedGateways as PublicBookingPaymentGateway[]);
          setBankAccounts(bankData || []);
          setOnlineBankingOptions(onlineOptions);
          setSelectedBillplzGatewayOptionId(onlineOptions.find((o) => o.is_default)?.id ?? onlineOptions[0]?.id ?? null);

          const firstMethod = (normalizedGateways.find((g) => g.key === "manual_transfer")?.key || normalizedGateways[0]?.key || "manual_transfer") as "manual_transfer" | "billplz_online_banking" | "billplz_credit_card";
          setSelectedPaymentMethod(firstMethod);

          const defaultBank = (bankData || []).find((b) => b.is_default) || (bankData || [])[0] || null;
          setSelectedBankAccountId(defaultBank?.id ?? null);
        })
        .catch(() => {
          setGateways([]);
          setBankAccounts([]);
        });
    }
  }, [isOpen, loadCart]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(async () => {
      if (!cart?.items?.length) return;
      const expired = cart.items.find((item) => secondsLeft(item.expires_at) <= 0);
      if (expired) {
        await removeCartItem(expired.id);
        setMessage("Slot expired and removed from cart");
        await loadCart();
      } else {
        setCart((current) => (current ? { ...current } : current));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cart, isOpen, loadCart]);

  const nextExpiryIn = useMemo(() => {
    if (!cart?.next_expiry_at) return null;
    return formatDuration(secondsLeft(cart.next_expiry_at));
  }, [cart]);

  const hasPackageItems = (cart?.package_items?.length || 0) > 0;

  useEffect(() => {
    if (!isOpen || !isLoggedIn || !customerId || !cart?.items?.length) return;

    const loadAvailability = async () => {
      const next: Record<number, number> = {};
      await Promise.all(
        cart.items.map(async (item) => {
          try {
            const rows = await getServicePackageAvailableFor(customerId, item.service_id);
            next[item.id] = rows.reduce((sum, row) => sum + Number(row.remaining_qty || 0), 0);
          } catch {
            next[item.id] = 0;
          }
        })
      );
      setAvailableMap(next);
    };

    void loadAvailability();
  }, [cart?.items, customerId, isLoggedIn, isOpen]);

  const onCheckout = async () => {
    try {
      setFieldErrors({});
      setMessage(null);

      const nextErrors: Record<string, string> = {};
      const normalizedGuestPhone = guestPhone.trim();
      const normalizedBillingPhone = billingPhone.trim();
      const phonePattern = /^\+?[0-9]{8,15}$/;

      if (!guestName.trim()) {
        nextErrors.guest_name = "Contact name is required.";
      }

      if (!normalizedGuestPhone) {
        nextErrors.guest_phone = "Contact phone is required.";
      } else if (!phonePattern.test(normalizedGuestPhone)) {
        nextErrors.guest_phone = "Please enter a valid phone number (8-15 digits, optional + prefix).";
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!guestEmail.trim()) {
        nextErrors.guest_email = "Contact email is required.";
      } else if (!emailPattern.test(guestEmail.trim())) {
        nextErrors.guest_email = "Please enter a valid email address.";
      }

      if (!billingSameAsContact) {
        if (!billingName.trim()) {
          nextErrors.billing_name = "Billing name is required.";
        }

        if (!normalizedBillingPhone) {
          nextErrors.billing_phone = "Billing phone is required.";
        } else if (!phonePattern.test(normalizedBillingPhone)) {
          nextErrors.billing_phone = "Please enter a valid phone number (8-15 digits, optional + prefix).";
        }

        if (!billingEmail.trim()) {
          nextErrors.billing_email = "Billing email is required.";
        } else if (!emailPattern.test(billingEmail.trim())) {
          nextErrors.billing_email = "Please enter a valid email address.";
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setMessage("Please complete the required contact information before checkout.");
        return;
      }

      if (!isZeroPayableCheckout && selectedPaymentMethod === "manual_transfer" && !selectedBankAccountId) {
        setMessage("Please select a bank account for manual transfer.");
        return;
      }
      if (!isZeroPayableCheckout && selectedPaymentMethod === "billplz_online_banking" && !selectedBillplzGatewayOptionId) {
        if (onlineBankingOptions.length > 0) {
          setMessage("Please select an online banking option.");
          return;
        }
      }

      const checkoutResponse = await checkoutCart(
        {
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim(),
          billing_same_as_contact: billingSameAsContact,
          billing_name: billingSameAsContact ? guestName.trim() : billingName.trim(),
          billing_phone: billingSameAsContact ? guestPhone.trim() : billingPhone.trim(),
          billing_email: billingSameAsContact ? guestEmail.trim() : billingEmail.trim(),
          payment_method: isZeroPayableCheckout ? undefined : selectedPaymentMethod,
          bank_account_id: !isZeroPayableCheckout && selectedPaymentMethod === "manual_transfer" ? (selectedBankAccountId ?? undefined) : undefined,
          billplz_gateway_option_id: !isZeroPayableCheckout && selectedPaymentMethod === "billplz_online_banking" ? (selectedBillplzGatewayOptionId ?? undefined) : undefined,
        },
      );

      if (process.env.NODE_ENV !== "production") {
        console.info("[Booking CartDrawer] checkout totals verification", {
          booking_item_count: cart?.items?.length ?? 0,
          package_item_count: cart?.package_items?.length ?? 0,
          displayed_total: Number(cart?.package_total ?? 0) + depositDisplay.total,
          displayed_deposit_total: depositDisplay.total,
          displayed_package_total: Number(cart?.package_total ?? 0),
          checkout_response_cart_total: Number(checkoutResponse?.cart_total ?? 0),
          checkout_response_deposit_total: Number(checkoutResponse?.deposit_total ?? 0),
          checkout_response_package_total: Number(checkoutResponse?.package_total ?? 0),
          checkout_response_booking_ids: checkoutResponse?.booking_ids ?? [],
          checkout_response_order_id: checkoutResponse?.order_id ?? null,
          checkout_response_payment_method: checkoutResponse?.payment_method ?? null,
        });
      }

      if (checkoutResponse?.payment_url) {
        window.location.href = checkoutResponse.payment_url;
        return;
      }

      const orderId = checkoutResponse?.order_id;
      const orderNo = checkoutResponse?.order_no;
      const bookingId = checkoutResponse?.booking_ids?.[0];

      // For multi-line booking cart checkout, pay via order whenever an order is returned.
      // This guarantees Billplz amount uses order.grand_total (full cart payable) instead of
      // a single booking deposit amount.
      if (orderId) {
        const isZeroCheckoutResponse = Number(checkoutResponse?.cart_total ?? 0) <= 0 || String(checkoutResponse?.payment_status ?? "").toLowerCase() === "paid";
        if (isZeroCheckoutResponse) {
          onClose();
          const nextParams = new URLSearchParams({
            order_id: String(orderId),
            payment_method: String(checkoutResponse?.payment_method ?? "no_payment_required"),
            provider: "none",
          });
          if (orderNo) {
            nextParams.set("order_no", orderNo);
          }
          router.push(`/payment-result?${nextParams.toString()}`);
          return;
        }

        if (selectedPaymentMethod !== "manual_transfer") {
          const payResponse = await payPublicOrder(orderId, {
            payment_method: selectedPaymentMethod,
            billplz_gateway_option_id: selectedPaymentMethod === "billplz_online_banking" ? (selectedBillplzGatewayOptionId ?? undefined) : undefined,
          });
          const redirectUrl = payResponse?.data?.redirect_url;
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }
        }

        onClose();
        const nextParams = new URLSearchParams({
          order_id: String(orderId),
          payment_method: selectedPaymentMethod,
          provider: selectedPaymentMethod === "manual_transfer" ? "manual" : "billplz",
        });
        if (orderNo) {
          nextParams.set("order_no", orderNo);
        }
        router.push(`/payment-result?${nextParams.toString()}`);
        return;
      }

      // Fallback for legacy/non-order checkout (e.g. guest flow) where only booking_id exists.
      if (bookingId) {
        const paymentResponse = await payBooking(bookingId, {
          payment_method: selectedPaymentMethod,
          bank_account_id: selectedPaymentMethod === "manual_transfer" ? (selectedBankAccountId ?? undefined) : undefined,
          billplz_gateway_option_id: selectedPaymentMethod === "billplz_online_banking" ? (selectedBillplzGatewayOptionId ?? undefined) : undefined,
        });

        const paymentData = paymentResponse?.data;
        if (paymentData?.payment_url) {
          window.location.href = paymentData.payment_url;
          return;
        }

        onClose();
        const bookingOrderNo = paymentData?.order_no;
        const nextParams = new URLSearchParams({
          order_id: String(paymentData?.order_id ?? bookingId),
          payment_method: String(paymentData?.payment_method ?? selectedPaymentMethod),
          provider: String(paymentData?.provider ?? "manual"),
        });
        if (bookingOrderNo) {
          nextParams.set("order_no", bookingOrderNo);
        }
        router.push(`/payment-result?${nextParams.toString()}`);
        return;
      }

      const hasPackageOnlyCheckout = (checkoutResponse?.owned_package_ids?.length ?? 0) > 0;
      if (hasPackageOnlyCheckout) {
        onClose();
        router.push("/account/orders");
        return;
      }

      setMessage("Unable to create booking payment. Please try again.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed. Please review your cart and try again.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /** Closing the drawer (X, backdrop, or parent) should drop validation + top banners so reopening is clean. */
  useEffect(() => {
    if (!isOpen) {
      setMessage(null);
      setFieldErrors({});
      setPackageActionItemId(null);
      setPackageQtyBusyId(null);
    }
  }, [isOpen]);

  const paymentOptions = gateways
    .filter((gateway) => ["manual_transfer", "billplz_online_banking", "billplz_credit_card"].includes(gateway.key))
    .map((gateway) => ({ key: gateway.key as "manual_transfer" | "billplz_online_banking" | "billplz_credit_card", name: gateway.name }));

  const itemCount = (cart?.items?.length || 0) + (cart?.package_items?.length || 0);
  const hasItems = itemCount > 0;
  const isZeroPayableCheckout = Number(cart?.cart_total ?? 0) <= 0;
  const depositDisplay = useMemo(() => {
    const bookingItems = cart?.items ?? [];

    if (bookingItems.length === 0) {
      return {
        total: 0,
        perItem: {} as Record<number, number>,
      };
    }

    const backendTotal = Number(cart?.deposit_total ?? 0);
    const calculatedTotal = bookingItems.reduce((sum, item) => sum + Number(item.deposit_amount ?? 0), 0);
    const total =
      Number.isFinite(backendTotal) && Math.abs(backendTotal - calculatedTotal) < 0.01
        ? backendTotal
        : calculatedTotal;

    const perItem: Record<number, number> = {};
    bookingItems.forEach((item) => {
      perItem[item.id] = Number(item.deposit_amount ?? 0);
    });

    return { total, perItem };
  }, [cart?.deposit_total, cart?.items]);
  const mainDepositTotal = Number.isFinite(Number(cart?.main_deposit_total))
    ? Number(cart?.main_deposit_total ?? 0)
    : (cart?.items ?? []).reduce((sum, item) => sum + Number(item.main_deposit_amount ?? 0), 0);
  const addonDepositTotal = Number.isFinite(Number(cart?.addon_deposit_total))
    ? Number(cart?.addon_deposit_total ?? 0)
    : (cart?.items ?? []).reduce((sum, item) => sum + Number(item.addon_deposit_amount ?? 0), 0);

  const estimatedPayLaterTotal = useMemo(() => {
    return (cart?.items ?? []).reduce((sum, item) => {
      const listed = Number(item.listed_service_price ?? 0);
      const addonMenu = Number(item.addon_price ?? 0);
      const menuTotal = listed + addonMenu;
      if (menuTotal <= 0) return sum;
      const lineDep = Number(depositDisplay.perItem[item.id] ?? item.deposit_amount ?? 0);
      return sum + Math.max(0, menuTotal - lineDep);
    }, 0);
  }, [cart?.items, depositDisplay]);

  const handlePhotoUpload = async (itemId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    if (arr.some((file) => !file.type.startsWith("image/"))) {
      setMessage("Only image files are allowed.");
      return;
    }
    if (arr.some((file) => file.size > 5 * 1024 * 1024)) {
      setMessage("Each photo must be 5MB or smaller.");
      return;
    }
    setPhotoBusyItemId(itemId);
    try {
      const updatedCart = await uploadBookingCartItemPhotos(itemId, arr);
      setCart(updatedCart);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload photos.");
    } finally {
      setPhotoBusyItemId(null);
    }
  };

  const handlePhotoRemove = async (itemId: number, photoId: number) => {
    setPhotoBusyItemId(itemId);
    try {
      const updatedCart = await removeBookingCartItemPhoto(itemId, photoId);
      setCart(updatedCart);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove photo.");
    } finally {
      setPhotoBusyItemId(null);
    }
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[var(--foreground)]/20 backdrop-blur-[6px] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`fixed right-0 top-0 z-[51] flex h-full w-full max-w-xl flex-col border-l border-[var(--card-border)] bg-[var(--card)] shadow-[-16px_0_48px_-20px_rgba(60,36,50,0.22)] ring-1 ring-black/[0.04] transition-transform duration-300 ease-out sm:rounded-l-3xl ${
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="h-1 shrink-0 bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-[var(--accent-stronger)] sm:rounded-tl-3xl" />

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--card-border)] bg-[var(--card)] px-5 pb-4 pt-5 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Checkout</p>
            <h2 className="font-[var(--font-heading)] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Booking cart
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Close cart"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {message ? (
            <div
              className="mb-5 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]"
              role="status"
            >
              {message}
            </div>
          ) : null}

          {!hasItems ? (
            <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
              Review slots and packages here before you pay your deposit.
            </p>
          ) : (
            <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
              Double-check your appointment time, then complete payment below.
            </p>
          )}
          {allowNoDepositBooking ? (
            <div className="mb-4 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
              Deposit waived for this member. Booking deposit is not required for checkout.
            </div>
          ) : null}
          {isZeroPayableCheckout ? (
            <div className="mb-4 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success)]">
              No payment required for this booking.
            </div>
          ) : null}

          <div className="space-y-2">
            {cart?.items?.map((item) => {
              const { timeRange } = formatSlotRange(item.start_at, item.end_at);
              const dateShort = new Date(item.start_at).toLocaleDateString("en-MY", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: TZ,
              });
              const sec = secondsLeft(item.expires_at);
              const urgent = sec > 0 && sec < 120;
              const premium = isPremiumService(item.service_type);
              const pkgBal = availableMap[item.id] ?? 0;
              const claimStatus = item.package_claim_status ?? null;
              const packageApplied =
                item.package_covers_main_service === true || claimStatus === "reserved" || claimStatus === "consumed";
              const canUnclaimPackage = claimStatus === "reserved";
              const refMain = Number(item.reference_main_deposit ?? 0);
              const mainDep = Number(item.main_deposit_amount ?? 0);
              const addonDep = Number(item.addon_deposit_amount ?? 0);
              const hasAddons = (item.selected_options?.length || 0) > 0;
              const lineDeposit = Number(depositDisplay.perItem[item.id] ?? item.deposit_amount ?? 0);
              const itemIsRange = item.price_mode === 'range' && item.price_range_min != null && item.price_range_max != null;
              const menuListedTotal = Number(item.listed_service_price ?? 0) + Number(item.addon_price ?? 0);
              const payLaterLine = menuListedTotal > 0 ? Math.max(0, menuListedTotal - lineDeposit) : null;
              const payLaterRangeMin = itemIsRange ? Math.max(0, Number(item.price_range_min) + Number(item.addon_price ?? 0) - lineDeposit) : null;
              const payLaterRangeMax = itemIsRange ? Math.max(0, Number(item.price_range_max) + Number(item.addon_price ?? 0) - lineDeposit) : null;

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border bg-[var(--card)] px-3 py-2.5 shadow-sm ${
                    premium
                      ? "border-[var(--accent-strong)]/40 border-l-[3px] border-l-[var(--accent-strong)]"
                      : "border-[var(--card-border)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-semibold leading-tight text-[var(--foreground)]">{item.service_name}</h3>
                        <span
                          className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            premium
                              ? "bg-[var(--accent-strong)] text-white"
                              : "border border-[var(--card-border)] bg-[var(--muted)]/60 text-[var(--text-muted)]"
                          }`}
                          title={premium ? "Premium tier" : "Standard tier"}
                        >
                          {premium ? <i className="fa-solid fa-crown text-[8px]" aria-hidden /> : null}
                          {premium ? "Premium" : "Std"}
                        </span>
                        {/* {isLoggedIn && pkgBal > 0 ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]" title="Uses left on your packages for this service">
                            Pkg bal. {pkgBal}
                          </span>
                        ) : null} */}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.staff_name}</p>
                      <p className="mt-1 text-[11px] leading-snug text-[var(--foreground)]">
                        <span className="font-medium tabular-nums">{timeRange}</span>
                        <span className="text-[var(--text-muted)]"> · {dateShort}</span>
                      </p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                          urgent ? "bg-[var(--status-error-bg)] text-[var(--status-error)]" : "bg-[var(--muted)]/80 text-[var(--foreground)]"
                        }`}
                      >
                        <i className={`fa-regular fa-clock text-[9px] ${urgent ? "" : "text-[var(--accent-strong)]"}`} aria-hidden />
                        {formatDuration(sec)} left
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/35 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Deposits</p>
                    <div className="mt-2 space-y-2 text-[11px]">
                      {packageApplied ? (
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--card-border)]/80 pb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--foreground)]">{item.service_name}</p>
                            <p className="text-[10px] text-[var(--status-success)]">Included in your package (main service)</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {refMain > 0 ? (
                              <span className="mr-1 tabular-nums text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/80">
                                RM {refMain.toFixed(2)}
                              </span>
                            ) : null}
                            {/* <span className="font-semibold tabular-nums text-[var(--status-success)]">RM {mainDep.toFixed(2)}</span> */}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between gap-2 border-b border-[var(--card-border)]/80 pb-2">
                          <span className="text-[var(--text-muted)]">Main service</span>
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">RM {mainDep.toFixed(2)}</span>
                        </div>
                      )}

                      {hasAddons ? (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add-ons</p>
                          {item.selected_options?.map((opt) => {
                            const matchedAddon = (item.addon_deposit_items ?? []).find((addon) => Number(addon.id) === Number(opt.id));
                            const addonPart = Number(matchedAddon?.deposit_contribution ?? 0);
                            return (
                              <div key={opt.id} className="flex justify-between gap-2 pl-1">
                                <span className="text-[var(--foreground)]">
                                  <span className="text-[var(--text-muted)]">+</span> {opt.label}
                                  {/* <span className="ml-1 text-[10px] text-[var(--text-muted)]">(not included in package)</span> */}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">RM {addonPart.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {packageApplied && hasAddons && addonDep > 0 ? (
                        <p className="text-[10px] leading-snug text-[var(--text-muted)]">
                          Your package covers the <strong className="font-medium text-[var(--foreground)]">main service</strong> only. Add-on deposits above are still due at checkout.
                        </p>
                      ) : null}

                      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-[var(--card-border)] pt-2">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Total deposit</span>
                        <span className="text-sm font-semibold tabular-nums text-[var(--accent-strong)]">RM {lineDeposit.toFixed(2)}</span>
                      </div>

                      {/* {(payLaterLine !== null || itemIsRange) ? (
                        <div
                          className="mt-2 space-y-1 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-2 ring-1 ring-[var(--status-success)]/10"
                          role="note"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--status-success)]">
                              Total (Pay later)
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-[var(--status-success)]">
                              {itemIsRange && payLaterRangeMin != null && payLaterRangeMax != null
                                ? `RM ${payLaterRangeMin.toFixed(2)} - ${payLaterRangeMax.toFixed(2)}`
                                : `RM ${(payLaterLine ?? 0).toFixed(2)}`}
                            </span>
                          </div>
                          <p className="text-[9px] leading-snug text-[var(--status-success)]/90">
                              Pay after your service at the salon
                          </p>
                        </div>
                      ) : null} */}
                    </div>
                  </div>

                  {item.allow_photo_upload ? (
                    <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/30 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reference photos</p>
                        <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--foreground)]">
                          {item.photos && item.photos.length > 0 ? "View Photos" : "Upload Photos"}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={photoBusyItemId === item.id || (item.photos?.length ?? 0) >= 3}
                            onChange={(event) => {
                              void handlePhotoUpload(item.id, event.target.files);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {item.photos && item.photos.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {item.photos.map((photo) => (
                            <div key={photo.id} className="relative overflow-hidden rounded-md border border-[var(--card-border)]">
                              <a href={photo.file_url} target="_blank" rel="noreferrer" className="block">
                                <img src={photo.file_url} alt={photo.original_name || "Reference photo"} className="h-16 w-full object-cover" />
                              </a>
                              <button
                                type="button"
                                onClick={() => void handlePhotoRemove(item.id, photo.id)}
                                disabled={photoBusyItemId === item.id}
                                className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                              >
                                <i className="fa-solid fa-xmark text-[10px]" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-[var(--text-muted)]">No photos uploaded yet.</p>
                      )}
                    </div>
                  ) : null}

                  {isLoggedIn ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {canUnclaimPackage ? (
                        <button
                          type="button"
                          disabled={packageActionItemId === item.id}
                          className="rounded-full border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1 text-[10px] font-semibold  tracking-wide text-[var(--status-warning-text)] disabled:opacity-50"
                          onClick={async () => {
                            setPackageActionItemId(item.id);
                            setMessage(null);
                            try {
                              const updated = await releaseBookingCartPackageClaim(item.id);
                              setCart(updated);
                              const count = (updated?.items?.length || 0) + (updated?.package_items?.length || 0);
                              window.dispatchEvent(new CustomEvent("cartUpdated", { detail: count }));
                              // setMessage("Package use removed for this slot. Deposit is calculated as usual.");
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : "Unable to remove package from this slot.");
                            } finally {
                              setPackageActionItemId(null);
                            }
                          }}
                        >
                          {packageActionItemId === item.id ? "…" : "Unclaim Package"}
                        </button>
                      ) : null}

                      {!packageApplied && pkgBal > 0 ? (
                        <button
                          type="button"
                          disabled={packageActionItemId === item.id}
                          className="rounded-full border-2 border-[var(--accent-strong)] bg-[var(--accent-strong)] px-2.5 py-1 text-[10px] font-semibold  tracking-wide text-white disabled:opacity-50"
                          onClick={async () => {
                            setPackageActionItemId(item.id);
                            setMessage(null);
                            try {
                              await redeemServicePackage({
                                customer_id: customerId || 0,
                                booking_service_id: item.service_id,
                                source: "BOOKING",
                                source_ref_id: item.id,
                                used_qty: 1,
                              });
                              await loadCart();
                              // setMessage("Main service covered by your package. Add-on deposits (if any) still apply at checkout.");
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : "Unable to apply package to this slot.");
                            } finally {
                              setPackageActionItemId(null);
                            }
                          }}
                        >
                          {packageActionItemId === item.id ? "…" : `Claim package (${pkgBal})`}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] active:bg-[var(--status-error-bg)]"
                        onClick={async () => {
                          const updatedCart = await removeCartItem(item.id);
                          setCart(updatedCart);
                          const count = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                          window.dispatchEvent(new CustomEvent("cartUpdated", { detail: count }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] active:bg-[var(--status-error-bg)]"
                        onClick={async () => {
                          const updatedCart = await removeCartItem(item.id);
                          setCart(updatedCart);
                          const count = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                          window.dispatchEvent(new CustomEvent("cartUpdated", { detail: count }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {cart?.package_items?.map((pkg) => {
              const qtyBusy = packageQtyBusyId === pkg.id;
              const syncCartCount = (updated: BookingCart) => {
                setCart(updated);
                const count = (updated?.items?.length || 0) + (updated?.package_items?.length || 0);
                window.dispatchEvent(new CustomEvent("cartUpdated", { detail: count }));
              };
              return (
                <article
                  key={`pkg-${pkg.id}`}
                  className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold leading-tight text-[var(--foreground)]" title={pkg.package_name}>
                        {pkg.package_name}
                      </h3>
                      {/* <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">RM {pkg.unit_price.toFixed(2)} each</p> */}
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--accent-strong)]">
                      RM {pkg.line_total.toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex w-fit items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/50 p-1">
                      <button
                        type="button"
                        title={pkg.qty <= 1 ? "Remove package" : "Decrease quantity"}
                        disabled={qtyBusy}
                        onClick={async () => {
                          if (pkg.qty <= 1) {
                            setPackageQtyBusyId(pkg.id);
                            setMessage(null);
                            try {
                              const updatedCart = await removePackageCartItem(pkg.id);
                              syncCartCount(updatedCart);
                            } catch (err) {
                              setMessage(err instanceof Error ? err.message : "Unable to remove package.");
                            } finally {
                              setPackageQtyBusyId(null);
                            }
                            return;
                          }
                          setPackageQtyBusyId(pkg.id);
                          setMessage(null);
                          try {
                            const updatedCart = await updateBookingPackageCartItemQty(pkg.id, pkg.qty - 1);
                            syncCartCount(updatedCart);
                          } catch (err) {
                            setMessage(err instanceof Error ? err.message : "Unable to update quantity.");
                          } finally {
                            setPackageQtyBusyId(null);
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card)] text-sm font-bold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)]/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        {qtyBusy ? "…" : pkg.qty}
                      </span>
                      <button
                        type="button"
                        title="Increase quantity"
                        disabled={qtyBusy || pkg.qty >= 10}
                        onClick={async () => {
                          setPackageQtyBusyId(pkg.id);
                          setMessage(null);
                          try {
                            const updatedCart = await updateBookingPackageCartItemQty(pkg.id, pkg.qty + 1);
                            syncCartCount(updatedCart);
                          } catch (err) {
                            setMessage(err instanceof Error ? err.message : "Unable to update quantity.");
                          } finally {
                            setPackageQtyBusyId(null);
                          }
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card)] text-sm font-bold text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)]/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={qtyBusy}
                      className="shrink-0 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)] active:bg-[var(--status-error-bg)] disabled:opacity-50"
                      onClick={async () => {
                        setPackageQtyBusyId(pkg.id);
                        setMessage(null);
                        try {
                          const updatedCart = await removePackageCartItem(pkg.id);
                          syncCartCount(updatedCart);
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : "Unable to remove package.");
                        } finally {
                          setPackageQtyBusyId(null);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}

            {!hasItems ? (
              <div className="rounded-2xl border-2 border-dashed border-[var(--card-border)] bg-[var(--background)]/40 px-6 py-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)] text-2xl text-[var(--accent-strong)]">
                  <i className="fa-solid fa-bag-shopping" aria-hidden />
                </span>
                <p className="mt-4 font-[var(--font-heading)] text-lg font-semibold text-[var(--foreground)]">Your cart is empty</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Pick a service and time slot to see it here.</p>
                <Link
                  href="/booking"
                  onClick={onClose}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)] hover:shadow-lg"
                >
                  <i className="fa-solid fa-arrow-right text-xs" aria-hidden />
                  Browse services
                </Link>
              </div>
            ) : null}
          </div>

          {hasItems ? (
            <div className="mt-8 space-y-5 rounded-2xl border border-[var(--card-border)] bg-[var(--background)]/50 p-5 ring-1 ring-black/[0.03] sm:p-6">
              {!isLoggedIn && hasPackageItems ? (
                <p className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm text-[var(--status-warning-text)]">
                  Please log in first to checkout package items.
                </p>
              ) : null}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {isLoggedIn ? "Contact details" : "Guest details"}
                </p>
                <div className="grid gap-3">
                  <div>
                    <input
                      value={guestName}
                      onChange={(e) => {
                        setGuestName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, guest_name: "" }));
                      }}
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Name *"
                    />
                    {fieldErrors.guest_name ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.guest_name}</p> : null}
                  </div>
                  <div>
                    <input
                      value={guestPhone}
                      onChange={(e) => {
                        setGuestPhone(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, guest_phone: "" }));
                      }}
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Phone *"
                    />
                    {fieldErrors.guest_phone ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.guest_phone}</p> : null}
                  </div>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, guest_email: "" }));
                    }}
                    className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                    placeholder="Email *"
                  />
                  {fieldErrors.guest_email ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.guest_email}</p> : null}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Billing contact</p>
                <label className="mb-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent-strong)]"
                    checked={billingSameAsContact}
                    onChange={(e) => setBillingSameAsContact(e.target.checked)}
                  />
                  <span>Same as Shipping Address</span>
                </label>

                {billingSameAsContact ? (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                    Billing contact will use your contact details above.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div>
                      <input
                        value={billingName}
                        onChange={(e) => {
                          setBillingName(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, billing_name: "" }));
                        }}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                        placeholder="Billing Name *"
                      />
                      {fieldErrors.billing_name ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.billing_name}</p> : null}
                    </div>
                    <div>
                      <input
                        value={billingPhone}
                        onChange={(e) => {
                          setBillingPhone(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, billing_phone: "" }));
                        }}
                        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                        placeholder="Billing Phone *"
                      />
                      {fieldErrors.billing_phone ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.billing_phone}</p> : null}
                    </div>
                    <input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => {
                        setBillingEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, billing_email: "" }));
                      }}
                      className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Billing Email *"
                    />
                    {fieldErrors.billing_email ? <p className="mt-1 text-xs text-[var(--status-error)]">{fieldErrors.billing_email}</p> : null}
                  </div>
                )}
              </div>

              {!isZeroPayableCheckout ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment method</p>
                  <div className="space-y-2">
                    {paymentOptions.map((option) => (
                      <label
                        key={option.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                          selectedPaymentMethod === option.key
                            ? "border-[var(--accent-strong)] bg-[var(--muted)]/60 shadow-sm ring-2 ring-[var(--accent)]/25"
                            : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="booking_payment_method"
                          className="h-4 w-4 accent-[var(--accent-strong)]"
                          checked={selectedPaymentMethod === option.key}
                          onChange={() => setSelectedPaymentMethod(option.key)}
                        />
                        <span className="text-[var(--foreground)]">{option.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isZeroPayableCheckout && selectedPaymentMethod === "manual_transfer" ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Bank account</p>
                  <div className="space-y-2">
                    {bankAccounts.map((account) => (
                      <label
                        key={account.id}
                        className={`block cursor-pointer rounded-xl border-2 p-4 text-sm transition-all ${
                          selectedBankAccountId === account.id
                            ? "border-[var(--accent-strong)] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                            : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                        }`}
                      >
                        <div className="flex gap-3">
                          <input
                            type="radio"
                            name="booking_bank_account"
                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong)]"
                            checked={selectedBankAccountId === account.id}
                            onChange={() => setSelectedBankAccountId(account.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-[var(--font-heading)] font-semibold text-[var(--foreground)]">
                              {account.label || account.bank_name}
                            </p>
                            <p className="text-[var(--text-muted)]">{account.bank_name}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {account.account_name} · {account.account_number}
                            </p>
                            {account.logo_url ? (
                              <img src={account.logo_url} alt={account.bank_name} className="mt-3 h-8 w-auto object-contain" />
                            ) : null}
                            {account.qr_image_url ? (
                              <img
                                src={account.qr_image_url}
                                alt={`${account.bank_name} QR`}
                                className="mt-3 h-28 w-28 rounded-lg border border-[var(--card-border)] object-cover"
                              />
                            ) : null}
                            {account.instructions ? (
                              <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{account.instructions}</p>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isZeroPayableCheckout && selectedPaymentMethod === "billplz_online_banking" ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Online Banking</p>
                  {onlineBankingOptions.length === 0 ? (
                    <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                      No banks configured yet. We&apos;ll continue with Billplz generic online banking flow.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {onlineBankingOptions.map((option) => (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-all ${
                            selectedBillplzGatewayOptionId === option.id
                              ? "border-[var(--accent-strong)] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                              : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name="booking_billplz_online_option"
                            className="h-4 w-4 accent-[var(--accent-strong)]"
                            checked={selectedBillplzGatewayOptionId === option.id}
                            onChange={() => setSelectedBillplzGatewayOptionId(option.id)}
                          />
                          {option.logo_url ? (
                            <img src={option.logo_url} alt={option.name} className="h-7 w-7 shrink-0 object-contain" />
                          ) : (
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/30 text-[11px] font-semibold text-[var(--text-muted)]"
                              aria-hidden
                            >
                              {option.name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                          <span className="text-[var(--foreground)]">{option.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Payment summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Main service deposit</span>
                  <span className="font-medium tabular-nums text-[var(--foreground)]">RM {mainDepositTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Add-on deposit</span>
                  <span className="font-medium tabular-nums text-[var(--foreground)]">RM {addonDepositTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Packages</span>
                  <span className="font-medium tabular-nums text-[var(--foreground)]">RM {Number(cart?.package_total ?? 0).toFixed(2)}</span>
                </div>
                {/* {estimatedPayLaterTotal > 0 ? (
                  <div
                    className="flex justify-between gap-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5 text-sm ring-1 ring-[var(--status-success)]/10"
                    role="note"
                  >
                    <span className="font-medium text-[var(--status-success)]">Total (Pay later)</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--status-success)]">
                      RM {estimatedPayLaterTotal.toFixed(2)}
                    </span>
                  </div>
                ) : null} */}
                <div className="border-t border-[var(--card-border)] pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-[var(--font-heading)] text-base font-semibold text-[var(--foreground)]">Total</span>
                      <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">Due now — deposits + packages</p>
                    </div>
                    <span className="shrink-0 font-[var(--font-heading)] text-xl font-semibold tabular-nums text-[var(--accent-strong)]">
                      RM {(Number(cart?.package_total ?? 0) + depositDisplay.total).toFixed(2)}
                    </span>
                  </div>
                  {nextExpiryIn ? (
                    <p className="mt-3 border-t border-[var(--card-border)] pt-3 text-xs text-[var(--text-muted)]">
                      Next hold expires in <span className="font-semibold tabular-nums text-[var(--status-warning)]">{nextExpiryIn}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onCheckout}
                disabled={!hasItems || (!isLoggedIn && hasPackageItems)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-strong)] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-stronger)] hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
              >
                <i className="fa-solid fa-lock text-xs opacity-90" aria-hidden />
                {isZeroPayableCheckout ? "Confirm booking" : "Proceed to payment"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
