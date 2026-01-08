"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OrderDetailActions } from "./OrderDetailActions";

type OrderHeaderClientProps = {
  orderId: number;
  orderNo: string;
  placedAt?: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  reserveExpiresAt?: string | null;
};

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export function OrderHeaderClient({
  orderId,
  orderNo,
  placedAt,
  status,
  paymentStatus,
  paymentMethod,
  reserveExpiresAt,
}: OrderHeaderClientProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const statusKey = (status || "").toLowerCase();
  const paymentStatusKey = (paymentStatus || "").toLowerCase();
  const reserveExpiry = reserveExpiresAt ? new Date(reserveExpiresAt) : null;
  const remainingSeconds = reserveExpiry ? Math.max(0, Math.floor((reserveExpiry.getTime() - now) / 1000)) : null;
  const remainingLabel = remainingSeconds !== null ? formatCountdown(remainingSeconds) : null;
  const isExpired = remainingSeconds !== null && remainingSeconds === 0;

  const displayStatus = useMemo(() => {
    if (statusKey === "cancelled" || (statusKey === "pending" && paymentStatusKey === "unpaid" && isExpired)) {
      return "Cancelled";
    }
    if (paymentStatusKey === "failed") {
      return "Payment Failed";
    }
    if (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid") {
      return "Payment Proof Rejected";
    }
    if (statusKey === "pending" && paymentStatusKey === "unpaid") {
      return `Awaiting Payment${remainingLabel ? ` (${remainingLabel} left)` : ""}`;
    }
    if (statusKey === "processing" && paymentStatusKey === "unpaid") {
      return "Waiting for Verification";
    }
    if (statusKey === "confirmed" && paymentStatusKey === "paid") {
      return "Payment Confirmed";
    }
    if (statusKey === "processing" && paymentStatusKey === "paid") {
      return "Preparing";
    }
    if (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") {
      return "Ready for Pickup";
    }
    if (statusKey === "shipped") {
      return "Shipped";
    }
    if (statusKey === "completed") {
      return "Completed";
    }
    return status;
  }, [statusKey, paymentStatusKey, remainingLabel, status, isExpired]);

  const badgeStyle = useMemo(() => {
    if (
      statusKey === "cancelled" ||
      (statusKey === "pending" && paymentStatusKey === "unpaid" && isExpired) ||
      paymentStatusKey === "failed" ||
      (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid")
    ) {
      return "bg-[var(--status-error-bg)] text-[color:var(--status-error)] border-[var(--status-error-border)]";
    }
    if ((statusKey === "pending" && paymentStatusKey === "unpaid") || (statusKey === "processing" && paymentStatusKey === "unpaid")) {
      return "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[var(--status-warning-border)]";
    }
    if ((statusKey === "confirmed" && paymentStatusKey === "paid") || (statusKey === "processing" && paymentStatusKey === "paid") || (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") || statusKey === "shipped" || statusKey === "completed") {
      return "bg-[var(--status-success-bg)] text-[color:var(--status-success)] border-[var(--status-success-border)]";
    }
    return "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
  }, [statusKey, paymentStatusKey, isExpired]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/account/orders" className="text-sm font-semibold text-[var(--accent)]">
            ← Back to Orders
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Order No: {orderNo}</h1>
            <p className="text-sm text-[var(--foreground)]/70">
              {placedAt ? new Date(placedAt).toLocaleString() : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
            {displayStatus}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <OrderDetailActions
          orderId={orderId}
          status={status}
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
          reserveExpiresAt={reserveExpiresAt}
        />
      </div>
    </div>
  );
}
