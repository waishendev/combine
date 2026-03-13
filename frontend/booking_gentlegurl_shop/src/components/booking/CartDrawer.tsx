"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingCart } from "@/lib/types";
import { checkoutCart, getBookingCart, getMe, removeCartItem } from "@/lib/apiClient";

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatDuration(sec: number) {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [cart, setCart] = useState<BookingCart | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const loadCart = async () => {
    const data = await getBookingCart();
    setCart(data);
  };

  useEffect(() => {
    if (!open) return;

    getBookingCart()
      .then((data) => {
        setCart(data);
        setMessage(null);
      })
      .catch(() => setMessage("Unable to load cart."));

    getMe()
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;

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
  }, [cart, open]);

  const nextExpiryIn = useMemo(() => {
    if (!cart?.next_expiry_at) return null;
    return formatDuration(secondsLeft(cart.next_expiry_at));
  }, [cart]);

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

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md transform flex-col border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Booking cart"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Booking Cart</h2>
          <button onClick={onClose} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm">Close</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {message ? <p className="text-sm text-amber-700">{message}</p> : null}
          <p className="text-xs text-neutral-600">Deposit is charged per Premium service.</p>
          <p className="text-xs text-neutral-600">Standard services do not add extra deposit if at least one Premium exists.</p>

          <div className="space-y-3">
            {cart?.items?.map((item) => (
              <div key={item.id} className="rounded-xl border border-neutral-200 p-3">
                <p className="font-medium capitalize">{item.service_name} ({item.service_type})</p>
                <p className="text-sm text-neutral-600">{item.staff_name}</p>
                <p className="text-sm text-neutral-600">
                  {new Date(item.start_at).toLocaleString("en-MY", {
                    timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur",
                  })}
                </p>
                <p className="mt-1 text-xs text-red-600">Expires in {formatDuration(secondsLeft(item.expires_at))}</p>
                <button
                  className="mt-2 rounded-full border border-neutral-300 px-3 py-1 text-xs"
                  onClick={async () => setCart(await removeCartItem(item.id))}
                >
                  Remove
                </button>
              </div>
            ))}

            {!cart?.items?.length ? (
              <div className="rounded-xl border border-dashed border-neutral-300 p-5 text-center">
                <p className="text-sm text-neutral-600">Your cart is empty.</p>
                <Link href="/booking" onClick={onClose} className="mt-3 inline-flex rounded-full border px-4 py-2 text-sm">
                  Browse services
                </Link>
              </div>
            ) : null}
          </div>

          {!isLoggedIn ? (
            <div className="grid gap-2">
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Guest name *" />
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Guest phone *" />
              <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" placeholder="Guest email (optional)" />
            </div>
          ) : null}
        </div>

        <div className="border-t border-neutral-200 px-5 py-4">
          <p className="font-semibold">Deposit total: RM {cart?.deposit_total ?? 0}</p>
          <p className="text-sm text-neutral-600">Next expiry in: {nextExpiryIn ?? "-"}</p>
          <button onClick={onCheckout} disabled={!cart?.items?.length} className="mt-3 w-full rounded-full bg-black px-4 py-2.5 text-sm text-white disabled:opacity-40">
            Proceed to Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
