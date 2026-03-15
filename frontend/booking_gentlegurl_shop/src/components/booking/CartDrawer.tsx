"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { checkoutCart, getBookingCart, getMe, getServicePackageAvailableFor, redeemServicePackage, removeCartItem, removePackageCartItem } from "@/lib/apiClient";
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

  const loadCart = useCallback(async () => {
    try {
      const data = await getBookingCart();
      setCart(data);
      // Dispatch event to notify header to update cart count
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

      await checkoutCart(
        isLoggedIn
          ? {}
          : {
              guest_name: guestName.trim(),
              guest_phone: guestPhone.trim(),
              guest_email: guestEmail.trim() || undefined,
            },
      );
      onClose();
      router.push("/booking/success");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed. Please review your cart and try again.");
    }
  };

  // Prevent body scroll when drawer is open
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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-xl font-semibold">Booking Cart</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-neutral-100 transition-colors"
              aria-label="Close cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {message ? <p className="mb-4 text-sm text-amber-700">{message}</p> : null}
            <p className="mb-4 text-sm text-neutral-600">Deposit is charged per Premium service.</p>
            <p className="mb-4 text-sm text-neutral-600">Standard services do not add extra deposit if at least one Premium exists.</p>
            <p className="mb-6 text-sm text-neutral-600">If only Standard services selected, base deposit applies.</p>

            <div className="space-y-3">
              {cart?.items?.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{item.service_name} ({item.service_type})</p>
                      <p className="text-sm text-neutral-600">{item.staff_name}</p>
                      <p className="text-sm text-neutral-600">
                        {new Date(item.start_at).toLocaleString("en-MY", {
                          timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur",
                        })}
                      </p>
                      <p className="text-sm text-neutral-600">Item deposit: RM {Number(item.deposit_amount ?? 0).toFixed(2)}</p>
                      {item.package_claim_status === "reserved" || item.package_claim_status === "consumed" ? (
                        <p className="text-xs text-emerald-700">Claimed from package. Deposit waived for this item.</p>
                      ) : null}
                      <p className="mt-1 text-sm text-red-600">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
                    </div>
                    <div className="shrink-0 space-y-2 text-right">
                      {isLoggedIn ? (
                        <>
                          <p className="text-xs text-emerald-700">Package sessions: {availableMap[item.id] ?? 0}</p>
                          <button
                            className="rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 disabled:opacity-40"
                            disabled={!customerId || (availableMap[item.id] ?? 0) <= 0 || item.package_claim_status === "reserved" || item.package_claim_status === "consumed"}
                            onClick={async () => {
                              if (!customerId) return;
                              try {
                                await redeemServicePackage({
                                  customer_id: customerId,
                                  booking_service_id: item.service_id,
                                  source: "BOOKING",
                                  source_ref_id: item.id,
                                  used_qty: 1,
                                });
                                setMessage(`Package reserved for ${item.service_name}. Session will be consumed when booking is completed.`);
                                setAvailableMap((prev) => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }));
                                await loadCart();
                              } catch (err) {
                                setMessage(err instanceof Error ? err.message : "Unable to reserve package.");
                              }
                            }}
                          >
                            {item.package_claim_status === "reserved" || item.package_claim_status === "consumed"
                              ? "Package Claimed"
                              : "Claim Package (Reserve)"}
                          </button>
                        </>
                      ) : null}
                      <button
                        className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50 transition-colors"
                        onClick={async () => {
                          const updatedCart = await removeCartItem(item.id);
                          setCart(updatedCart);
                          // Notify header to update cart count
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

              {cart?.package_items?.map((pkg) => (
                <div key={`pkg-${pkg.id}`} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{pkg.package_name}</p>
                      <p className="text-sm text-neutral-600">Qty: {pkg.qty}</p>
                      <p className="text-sm text-neutral-600">Line total: RM {pkg.line_total}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <button
                        className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50 transition-colors"
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
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="text-neutral-600">Your cart is empty.</p>
                  <Link
                    href="/booking"
                    onClick={onClose}
                    className="mt-3 inline-flex rounded-full border px-4 py-2 text-sm hover:bg-neutral-50 transition-colors"
                  >
                    Browse services
                  </Link>
                </div>
              ) : null}
            </div>

            {(cart?.items?.length || cart?.package_items?.length) ? (
              <div className="mt-8 rounded-xl border p-4">
                {!isLoggedIn && hasPackageItems ? (
                  <p className="mb-3 text-sm text-amber-700">Please login first to checkout package items.</p>
                ) : null}
                {!isLoggedIn ? (
                  <div className="mb-4 grid gap-3">
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="rounded-lg border px-3 py-2"
                      placeholder="Guest name *"
                    />
                    <input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="rounded-lg border px-3 py-2"
                      placeholder="Guest phone *"
                    />
                    <input
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="rounded-lg border px-3 py-2"
                      placeholder="Guest email (optional)"
                    />
                  </div>
                ) : null}
                <p className="font-semibold">Deposit total: RM {cart?.deposit_total ?? 0}</p>
                <p className="font-semibold">Package total: RM {cart?.package_total ?? 0}</p>
                <p className="font-semibold">Cart total: RM {cart?.cart_total ?? cart?.deposit_total ?? 0}</p>
                <p className="text-sm text-neutral-600">Next expiry in: {nextExpiryIn ?? "-"}</p>
                <button
                  onClick={onCheckout}
                  disabled={!(cart?.items?.length || cart?.package_items?.length) || (!isLoggedIn && hasPackageItems)}
                  className="mt-4 w-full rounded-full bg-black px-6 py-3 text-white disabled:opacity-40 hover:bg-neutral-800 transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
