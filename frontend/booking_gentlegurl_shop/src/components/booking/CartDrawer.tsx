"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkoutCart,
  getBookingBankAccounts,
  getBookingCart,
  getBookingPaymentGateways,
  getMe,
  getServicePackageAvailableFor,
  payBooking,
  redeemServicePackage,
  removeCartItem,
  removePackageCartItem,
  type PublicBookingBankAccount,
  type PublicBookingPaymentGateway,
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

function isPremiumService(serviceType: "premium" | "standard") {
  return serviceType === "premium";
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatDuration(sec: number) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [availableMap, setAvailableMap] = useState<Record<number, number>>({});
  const [gateways, setGateways] = useState<PublicBookingPaymentGateway[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PublicBookingBankAccount[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"manual_transfer" | "billplz_fpx" | "billplz_card">("manual_transfer");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);

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
          setIsLoggedIn(true);
          setCustomerId(me.id);
        })
        .catch(() => {
          setIsLoggedIn(false);
          setCustomerId(null);
        });

      Promise.all([getBookingPaymentGateways(), getBookingBankAccounts()])
        .then(([gatewayData, bankData]) => {
          const activeGateways = gatewayData.filter((g) => g.is_active !== false);
          setGateways(activeGateways);
          setBankAccounts(bankData || []);

          const firstMethod = (activeGateways.find((g) => g.key === "manual_transfer")?.key || activeGateways[0]?.key || "manual_transfer") as "manual_transfer" | "billplz_fpx" | "billplz_card";
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
      if (!isLoggedIn && (!guestName.trim() || !guestPhone.trim())) {
        setMessage("Please fill in your name and phone to checkout as guest.");
        return;
      }

      if (!isLoggedIn) {
        const normalizedGuestPhone = guestPhone.trim();
        const guestPhonePattern = /^\+?[0-9]{8,15}$/;
        if (!guestPhonePattern.test(normalizedGuestPhone)) {
          setMessage("Please enter a valid phone number (8-15 digits, optional + prefix).");
          return;
        }
      }

      if (selectedPaymentMethod === "manual_transfer" && !selectedBankAccountId) {
        setMessage("Please select a bank account for manual transfer.");
        return;
      }

      const checkoutResponse = await checkoutCart(
        isLoggedIn
          ? {}
          : {
              guest_name: guestName.trim(),
              guest_phone: guestPhone.trim(),
              guest_email: guestEmail.trim() || undefined,
            },
      );

      const bookingId = checkoutResponse?.booking_ids?.[0];
      if (!bookingId) {
        setMessage("Unable to create booking payment. Please try again.");
        return;
      }

      const paymentResponse = await payBooking(bookingId, {
        payment_method: selectedPaymentMethod,
        bank_account_id: selectedPaymentMethod === "manual_transfer" ? (selectedBankAccountId ?? undefined) : undefined,
      });

      const paymentData = paymentResponse?.data;
      if (paymentData?.payment_url) {
        window.location.href = paymentData.payment_url;
        return;
      }

      onClose();
      router.push(`/booking/payment-result?booking_id=${bookingId}`);
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

  const paymentOptions = gateways
    .filter((gateway) => ["manual_transfer", "billplz_fpx", "billplz_card"].includes(gateway.key))
    .map((gateway) => ({ key: gateway.key as "manual_transfer" | "billplz_fpx" | "billplz_card", name: gateway.name }));

  const itemCount = (cart?.items?.length || 0) + (cart?.package_items?.length || 0);
  const hasItems = itemCount > 0;

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
        className={`fixed right-0 top-0 z-[51] flex h-full w-full max-w-md flex-col border-l border-[var(--card-border)] bg-[var(--card)] shadow-[-16px_0_48px_-20px_rgba(60,36,50,0.22)] ring-1 ring-black/[0.04] transition-transform duration-300 ease-out sm:rounded-l-3xl ${
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
            {hasItems ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {itemCount} {itemCount === 1 ? "item" : "items"}
                {nextExpiryIn ? (
                  <span className="mt-1 block text-xs font-medium text-[var(--status-warning)]">
                    <i className="fa-regular fa-hourglass-half mr-1.5" aria-hidden />
                    Hold expires in {nextExpiryIn}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--text-muted)]">Add a service or package to get started.</p>
            )}
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
                          {premium ? (
                            <i className="fa-solid fa-crown text-[8px]" aria-hidden />
                          ) : null}
                          {premium ? "Premium" : "Std"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.staff_name}</p>
                      <p className="mt-1 text-[11px] leading-snug text-[var(--foreground)]">
                        <span className="font-medium tabular-nums">{timeRange}</span>
                        <span className="text-[var(--text-muted)]"> · {dateShort}</span>
                      </p>
                    </div>
                    {typeof item.deposit_amount === "number" ? (
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Deposit</p>
                        <p className="text-sm font-semibold tabular-nums text-[var(--accent-strong)]">RM {item.deposit_amount}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                        urgent
                          ? "bg-[var(--status-error-bg)] text-[var(--status-error)]"
                          : "bg-[var(--muted)]/80 text-[var(--foreground)]"
                      }`}
                    >
                      <i className={`fa-regular fa-clock text-[9px] ${urgent ? "" : "text-[var(--accent-strong)]"}`} aria-hidden />
                      {formatDuration(sec)} left
                    </span>
                  </div>

                  {isLoggedIn ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded-full border border-[var(--card-border)] bg-[var(--background)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground)] active:bg-[var(--muted)]"
                        onClick={async () => {
                          try {
                            const customerPackages = availableMap[item.id] || 0;
                            if (customerPackages <= 0) {
                              setMessage("No available package balance for this service.");
                              return;
                            }
                            await redeemServicePackage({
                              customer_id: customerId || 0,
                              booking_service_id: item.service_id,
                              source: "BOOKING",
                              source_ref_id: item.id,
                              used_qty: 1,
                            });
                            await loadCart();
                            setMessage("Package redeemed. This booking slot no longer requires deposit.");
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Unable to redeem package for this slot.");
                          }
                        }}
                      >
                        Package ({availableMap[item.id] || 0})
                      </button>

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

            {cart?.package_items?.map((pkg) => (
              <article
                key={`pkg-${pkg.id}`}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-gift shrink-0 text-[10px] text-[var(--accent-strong)]" aria-hidden />
                      <h3 className="text-sm font-semibold leading-tight text-[var(--foreground)]">{pkg.package_name}</h3>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      ×{pkg.qty} @ RM {pkg.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold tabular-nums text-[var(--accent-strong)]">RM {pkg.line_total.toFixed(2)}</p>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] active:bg-[var(--status-error-bg)]"
                      onClick={async () => {
                        const updatedCart = await removePackageCartItem(pkg.id);
                        setCart(updatedCart);
                        const count = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                        window.dispatchEvent(new CustomEvent("cartUpdated", { detail: count }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}

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
              {!isLoggedIn ? (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Guest details</p>
                  <div className="grid gap-3">
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Name *"
                    />
                    <input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Phone *"
                    />
                    <input
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
                      placeholder="Email (optional)"
                    />
                  </div>
                </div>
              ) : null}

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

              {selectedPaymentMethod === "manual_transfer" ? (
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

              <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Deposit</span>
                  <span className="font-medium tabular-nums text-[var(--foreground)]">RM {cart?.deposit_total ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Packages</span>
                  <span className="font-medium tabular-nums text-[var(--foreground)]">RM {cart?.package_total ?? 0}</span>
                </div>
                <div className="border-t border-[var(--card-border)] pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-[var(--font-heading)] text-base font-semibold text-[var(--foreground)]">Total</span>
                    <span className="font-[var(--font-heading)] text-xl font-semibold tabular-nums text-[var(--accent-strong)]">
                      RM {cart?.cart_total ?? cart?.deposit_total ?? 0}
                    </span>
                  </div>
                  {nextExpiryIn ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
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
                Proceed to payment
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
