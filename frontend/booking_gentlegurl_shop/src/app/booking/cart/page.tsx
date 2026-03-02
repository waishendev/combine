"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { checkoutCart, getBookingCart, removeCartItem } from "@/lib/apiClient";
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
        await removeCartItem(expired.id);
        setMessage("Slot expired and removed from cart");
        await loadCart();
      } else {
        setCart((current) => (current ? { ...current } : current));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cart]);

  const nextExpiryIn = useMemo(() => {
    if (!cart?.next_expiry_at) return null;
    return formatDuration(secondsLeft(cart.next_expiry_at));
  }, [cart]);

  const onCheckout = async () => {
    try {
      await checkoutCart();
      router.push("/booking/success");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed. Please review your cart and try again.");
      router.push("/booking/failed");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <BookingProgress step={4} />
      <h1 className="text-3xl font-semibold">Booking Cart</h1>
      {message ? <p className="mt-3 text-amber-700">{message}</p> : null}
      <p className="mt-3 text-sm text-neutral-600">Deposit is charged per Premium service.</p>
      <p className="text-sm text-neutral-600">Standard services do not add extra deposit if at least one Premium exists.</p>
      <p className="text-sm text-neutral-600">If only Standard services selected, base deposit applies.</p>

      <div className="mt-6 space-y-3">
        {cart?.items?.map((item) => (
          <div key={item.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.service_name} ({item.service_type})</p>
                <p className="text-sm text-neutral-600">{item.staff_name}</p>
                <p className="text-sm text-neutral-600">{new Date(item.start_at).toLocaleString("en-MY", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur" })}</p>
                <p className="mt-1 text-sm text-red-600">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
              </div>
              <button className="rounded-full border px-4 py-2 text-sm" onClick={async () => setCart(await removeCartItem(item.id))}>Remove</button>
            </div>
          </div>
        ))}
        {!cart?.items?.length ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-neutral-600">Your cart is empty.</p>
            <Link href="/booking" className="mt-3 inline-flex rounded-full border px-4 py-2 text-sm">Browse services</Link>
          </div>
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border p-4">
        <p className="font-semibold">Deposit total: RM {cart?.deposit_total ?? 0}</p>
        <p className="text-sm text-neutral-600">Next expiry in: {nextExpiryIn ?? "-"}</p>
        <button onClick={onCheckout} disabled={!cart?.items?.length} className="mt-4 rounded-full bg-black px-6 py-3 text-white disabled:opacity-40">Proceed to Checkout</button>
      </div>
    </main>
  );
}
