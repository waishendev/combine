"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutCart, getBookingCart, removeCartItem } from "@/lib/apiClient";
import { BookingCart } from "@/lib/types";
import { BOOKING_CART_CHANGED_EVENT, emitBookingCartChanged } from "@/lib/bookingCartEvents";

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatDuration(sec: number) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<BookingCart | null>(null);

  const loadCart = async () => {
    setLoading(true);
    try {
      const data = await getBookingCart();
      setCart(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadCart();
  }, [open]);

  useEffect(() => {
    const refresh = () => {
      if (open) loadCart();
    };
    window.addEventListener(BOOKING_CART_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BOOKING_CART_CHANGED_EVENT, refresh);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", keyHandler);
    setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("button, [href]")?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!open || !cart?.items?.length) return;
      const expired = cart.items.find((item) => secondsLeft(item.expires_at) <= 0);
      if (expired) {
        const next = await removeCartItem(expired.id);
        setCart(next);
        emitBookingCartChanged();
      } else {
        setCart((current) => (current ? { ...current } : current));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [open, cart]);

  const premiumCount = useMemo(() => cart?.items?.filter((item) => item.service_type === "premium").length ?? 0, [cart]);
  const standardCount = useMemo(() => cart?.items?.filter((item) => item.service_type === "standard").length ?? 0, [cart]);
  const nextExpiryIn = useMemo(() => {
    if (!cart?.next_expiry_at) return null;
    return formatDuration(secondsLeft(cart.next_expiry_at));
  }, [cart]);

  const proceedCheckout = async () => {
    await checkoutCart();
    emitBookingCartChanged();
    onClose();
    router.push("/booking/success");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button aria-label="Close cart drawer" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Booking cart"
        className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto bg-white p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-semibold">Booking Cart</h2>
          <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm">Close</button>
        </div>

        {loading ? (
          <div className="space-y-3 pt-4">
            <div className="h-20 animate-pulse rounded-xl bg-neutral-100" />
            <div className="h-20 animate-pulse rounded-xl bg-neutral-100" />
            <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
          </div>
        ) : !cart?.items?.length ? (
          <div className="pt-6 text-center">
            <p className="font-medium">Your booking cart is empty</p>
            <Link href="/booking" onClick={onClose} className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-sm text-white">
              Browse services
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {cart.items.map((item) => (
              <article key={item.id} className="rounded-xl border p-3">
                <p className="font-medium">{item.service_name}</p>
                <p className="text-sm text-neutral-600">{item.staff_name}</p>
                <p className="text-sm text-neutral-600">
                  {new Date(item.start_at).toLocaleString("en-MY", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm text-red-600">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
                  <button
                    onClick={async () => {
                      const next = await removeCartItem(item.id);
                      setCart(next);
                      emitBookingCartChanged();
                    }}
                    className="rounded-full border px-3 py-1 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}

            <section className="rounded-xl border bg-neutral-50 p-3 text-sm">
              <p>Premium: {premiumCount}</p>
              <p>Standard: {standardCount}</p>
              <p className="font-semibold">Deposit total: RM {cart.deposit_total}</p>
              <p>Next expiry in {nextExpiryIn ?? "--:--"}</p>
            </section>

            <button
              onClick={proceedCheckout}
              disabled={!cart.items.length}
              className="w-full rounded-full bg-black px-4 py-3 text-white disabled:opacity-40"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
