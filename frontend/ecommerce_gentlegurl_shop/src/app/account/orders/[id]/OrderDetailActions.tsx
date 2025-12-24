"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/lib/apiClient";

type OrderDetailActionsProps = {
  orderId: number;
  status: string;
  paymentStatus: string;
  reserveExpiresAt?: string | null;
};

export function OrderDetailActions({
  orderId,
  status,
  paymentStatus,
  reserveExpiresAt,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reserveExpiry = reserveExpiresAt ? new Date(reserveExpiresAt) : null;
  const isExpired = reserveExpiry ? reserveExpiry.getTime() < Date.now() : false;
  const canPay = status === "pending" && paymentStatus === "unpaid" && !isExpired;
  const showExpired = status === "cancelled" || isExpired;

  const handleCancel = async () => {
    setError(null);
    setIsCancelling(true);
    try {
      await cancelOrder(orderId);
      router.refresh();
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to cancel this order."
          : "Unable to cancel this order.";
      setError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!canPay && !showExpired) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">Actions</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canPay ? (
          <>
            <Link
              href={`/checkout?order_id=${orderId}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)]"
            >
              Pay Now
            </Link>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </button>
          </>
        ) : (
          <span className="text-xs font-semibold uppercase text-rose-600">Expired / Cancelled</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
