"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { checkoutCart, getBookingCart, removeCartItem } from "@/lib/apiClient";
import { emitBookingCartChanged, emitOpenBookingCartDrawer } from "@/lib/bookingCartEvents";
import { BookingCart } from "@/lib/types";

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatDuration(sec: number) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function BookingCartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<BookingCart | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCart = async () => {
    const data = await getBookingCart();
    setCart(data);
  };

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!cart?.items?.length) return;
      const expired = cart.items.find((item) => secondsLeft(item.expires_at) <= 0);
      if (expired) {
        const next = await removeCartItem(expired.id);
        setCart(next);
        emitBookingCartChanged();
        setMessage("Slot expired and removed from cart");
      } else {
        setCart((current) => (current ? { ...current } : current));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cart]);

  const premiumCount = useMemo(
    () => cart?.items?.filter((item) => item.service_type === "premium").length ?? 0,
    [cart],
  );

  const standardCount = useMemo(
    () => cart?.items?.filter((item) => item.service_type === "standard").length ?? 0,
    [cart],
  );

  const nextExpiryIn = useMemo(() => {
    if (!cart?.next_expiry_at) return null;
    return formatDuration(secondsLeft(cart.next_expiry_at));
  }, [cart]);

  const isCheckoutDisabled = !cart?.items?.length;

  const onCheckout = async () => {
    await checkoutCart();
    emitBookingCartChanged();
    router.push("/booking/success");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <BookingProgress step={4} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Booking Cart</h1>
        <div className="flex items-center gap-2">
          <button onClick={emitOpenBookingCartDrawer} className="rounded-full border border-neutral-300 px-4 py-2 text-sm">Open Cart</button>
          <Link href="/booking" className="rounded-full bg-black px-4 py-2 text-sm text-white">Continue booking</Link>
        </div>
      </div>
      {message ? <p className="mt-3 text-amber-700">{message}</p> : null}

      {!cart?.items?.length ? (
        <section className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold">Your booking cart is empty</h2>
          <p className="mt-2 text-sm text-neutral-600">Add services to your cart to reserve a slot before checkout.</p>
          <Link href="/booking" className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm text-white">
            Browse services
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.service_name}</p>
                    <p className="text-sm text-neutral-600">Staff: {item.staff_name}</p>
                    <p className="text-sm text-neutral-600">
                      {new Date(item.start_at).toLocaleString("en-MY", {
                        timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur",
                      })}
                    </p>
                    <p className="mt-1 text-sm text-red-600">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
                  </div>
                  <button
                    className="rounded-full border px-4 py-2 text-sm"
                    onClick={async () => {
                      setCart(await removeCartItem(item.id));
                      emitBookingCartChanged();
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </section>

          <aside className="h-fit rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-semibold">Summary</h2>
            <div className="mt-3 space-y-2 text-sm text-neutral-700">
              <p>Premium services: {premiumCount}</p>
              <p>Standard services: {standardCount}</p>
              <p className="font-medium text-neutral-900">Deposit total: RM {cart.deposit_total}</p>
              <p>Next expiry in: {nextExpiryIn ?? "--:--"}</p>
            </div>
            <button
              onClick={onCheckout}
              disabled={isCheckoutDisabled}
              className="mt-5 w-full rounded-full bg-black px-6 py-3 text-white disabled:opacity-40"
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
