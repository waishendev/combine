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
  const isBillplzMethod = selectedPaymentMethod === "billplz_fpx" || selectedPaymentMethod === "billplz_card";

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
        onClose();
        router.push(isBillplzMethod ? "/booking/failed" : "/booking/success");
        return;
      }

      const paymentResponse = await payBooking(bookingId, {
        payment_method: selectedPaymentMethod,
        bank_account_id: selectedPaymentMethod === "manual_transfer" ? (selectedBankAccountId ?? undefined) : undefined,
      });

      const paymentData = paymentResponse?.data;
      if (isBillplzMethod && paymentData?.payment_url) {
        window.location.href = paymentData.payment_url;
        return;
      }

      if (isBillplzMethod) {
        setMessage("Unable to start Billplz payment. Please try again.");
        return;
      }

      onClose();
      router.push("/booking/success");
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

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-50 bg-black/50 transition-opacity" onClick={onClose} aria-hidden="true" />}

      <div className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-[var(--card)] shadow-xl transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-4">
            <h2 className="text-xl font-semibold">Booking Cart</h2>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-[var(--muted)] transition-colors" aria-label="Close cart">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {message ? <p className="mb-4 text-sm text-[var(--status-warning)]">{message}</p> : null}
            <p className="mb-4 text-sm text-[var(--text-muted)]">Review your selected booking slot before checkout.</p>

            <div className="space-y-3">
              {cart?.items?.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--card-border)] p-4">
                  <p className="font-medium">{item.service_name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{item.staff_name}</p>
                  <p className="text-sm text-[var(--text-muted)]">{new Date(item.start_at).toLocaleString()}</p>
                  <p className="text-xs text-[var(--status-warning)] mt-2">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
                  {isLoggedIn ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
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
                        Use Package ({availableMap[item.id] || 0})
                      </button>

                      <button
                        className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                        onClick={async () => {
                          const updatedCart = await removeCartItem(item.id);
                          setCart(updatedCart);
                          const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                          window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                        onClick={async () => {
                          const updatedCart = await removeCartItem(item.id);
                          setCart(updatedCart);
                          const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                          window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {cart?.package_items?.map((pkg) => (
                <div key={`pkg-${pkg.id}`} className="rounded-xl border border-[var(--card-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{pkg.package_name}</p>
                      <p className="text-sm text-[var(--text-muted)]">Qty: {pkg.qty}</p>
                      <p className="text-sm text-[var(--text-muted)]">RM {pkg.unit_price.toFixed(2)} each</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">RM {pkg.line_total.toFixed(2)}</p>
                      <button
                        className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                        onClick={async () => {
                          const updatedCart = await removePackageCartItem(pkg.id);
                          setCart(updatedCart);
                          const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
                          window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!(cart?.items?.length || cart?.package_items?.length) ? (
                <div className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-center">
                  <p className="text-[var(--text-muted)]">Your cart is empty.</p>
                  <Link href="/booking" onClick={onClose} className="mt-3 inline-flex rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors">
                    Browse services
                  </Link>
                </div>
              ) : null}
            </div>

            {(cart?.items?.length || cart?.package_items?.length) ? (
              <div className="mt-8 rounded-xl border border-[var(--card-border)] p-4 space-y-4">
                {!isLoggedIn && hasPackageItems ? <p className="text-sm text-[var(--status-warning)]">Please login first to checkout package items.</p> : null}
                {!isLoggedIn ? (
                  <div className="grid gap-3">
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2" placeholder="Guest name *" />
                    <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2" placeholder="Guest phone *" />
                    <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2" placeholder="Guest email (optional)" />
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-semibold mb-2">Payment Method</p>
                  <div className="space-y-2">
                    {paymentOptions.map((option) => (
                      <label key={option.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="booking_payment_method"
                          checked={selectedPaymentMethod === option.key}
                          onChange={() => setSelectedPaymentMethod(option.key)}
                        />
                        <span>{option.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedPaymentMethod === "manual_transfer" ? (
                  <div>
                    <p className="text-sm font-semibold mb-2">Select Bank Account</p>
                    <div className="space-y-2">
                      {bankAccounts.map((account) => (
                        <label key={account.id} className="block rounded-lg border border-[var(--card-border)] p-3 text-sm cursor-pointer">
                          <div className="flex gap-3">
                            <input
                              type="radio"
                              name="booking_bank_account"
                              className="mt-1"
                              checked={selectedBankAccountId === account.id}
                              onChange={() => setSelectedBankAccountId(account.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{account.label || account.bank_name}</p>
                              <p className="text-[var(--text-muted)]">{account.bank_name}</p>
                              <p className="text-[var(--text-muted)]">{account.account_name} · {account.account_number}</p>
                              {account.logo_url ? <img src={account.logo_url} alt={account.bank_name} className="mt-2 h-8 w-auto" /> : null}
                              {account.qr_image_url ? <img src={account.qr_image_url} alt={`${account.bank_name} QR`} className="mt-2 h-28 w-28 object-cover rounded-md" /> : null}
                              {account.instructions ? <p className="mt-2 text-xs text-[var(--text-muted)]">{account.instructions}</p> : null}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="font-semibold">Deposit total: RM {cart?.deposit_total ?? 0}</p>
                  <p className="font-semibold">Package total: RM {cart?.package_total ?? 0}</p>
                  <p className="font-semibold">Cart total: RM {cart?.cart_total ?? cart?.deposit_total ?? 0}</p>
                  <p className="text-sm text-[var(--text-muted)]">Next expiry in: {nextExpiryIn ?? "-"}</p>
                </div>

                <button
                  onClick={onCheckout}
                  disabled={!(cart?.items?.length || cart?.package_items?.length) || (!isLoggedIn && hasPackageItems)}
                  className="w-full rounded-full bg-[var(--accent-strong)] px-6 py-3 text-white disabled:opacity-40 hover:bg-[var(--accent-stronger)] transition-colors"
                >
                  Proceed Payment
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
