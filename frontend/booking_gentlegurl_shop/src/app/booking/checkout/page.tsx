"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { payBooking } from "@/lib/apiClient";

export default function CheckoutPage() {
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
      router.push(`/booking/payment-result?booking_id=${bookingId}`);
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
