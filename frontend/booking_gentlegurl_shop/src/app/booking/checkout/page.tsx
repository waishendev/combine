"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { payBooking } from "@/lib/apiClient";

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const bookingId = params.get("booking_id") || "";
  const expiresAt = params.get("expires_at") || "";
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const countdown = useMemo(() => `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`, [remaining]);

  const onPay = async () => {
    setPaying(true);
    try {
      const response = await payBooking(bookingId);
      if (response?.data?.payment_url) {
        window.location.href = response.data.payment_url;
        return;
      }
      const payload = response?.data;
      const nextParams = new URLSearchParams({
        order_id: String(payload?.order_id ?? bookingId),
        payment_method: String(payload?.payment_method ?? "manual_transfer"),
        provider: String(payload?.provider ?? "manual"),
      });
      if (payload?.order_no) {
        nextParams.set("order_no", payload.order_no);
      }
      router.push(`/payment-result?${nextParams.toString()}`);
    } finally {
      setPaying(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <BookingProgress step={4} />
      <h1 className="text-3xl font-semibold">Checkout deposit</h1>
      <p className="mt-2 text-[var(--text-muted)]">Your slot is reserved for 15 minutes.</p>
      <p className="mt-2 inline-block rounded-full bg-[var(--muted)] px-3 py-1 text-sm">Time left: {countdown}</p>
      <button onClick={onPay} disabled={paying || !bookingId} className="mt-8 rounded-full bg-[var(--accent-strong)] px-6 py-3 text-white disabled:opacity-40 hover:bg-[var(--accent-stronger)] transition-colors">
        {paying ? "Processing..." : "Pay Deposit"}
      </button>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-3xl justify-center px-4 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
