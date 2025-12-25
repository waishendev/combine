"use client";

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
  const reserveExpiry = reserveExpiresAt ? new Date(reserveExpiresAt) : null;
  const remainingSeconds = reserveExpiry ? Math.max(0, Math.floor((reserveExpiry.getTime() - now) / 1000)) : null;
  const remainingLabel = remainingSeconds !== null ? formatCountdown(remainingSeconds) : null;
  const isExpired = remainingSeconds !== null && remainingSeconds === 0;
  const isPendingUnpaidExpired = statusKey === "pending" && paymentStatus === "unpaid" && isExpired;

  const displayStatus = useMemo(() => {
    if (isPendingUnpaidExpired) {
      return "Cancelled";
    }
    if (statusKey === "pending" && paymentStatus === "unpaid") {
      return `Pending Payment${remainingLabel ? ` (${remainingLabel} left)` : ""}`;
    }
    if (statusKey === "processing" && paymentStatus === "unpaid") {
      return "Waiting for verification";
    }
    if (statusKey === "paid" && paymentStatus === "paid") {
      return "Paid";
    }
    if (statusKey === "completed" && paymentStatus === "paid") {
      return "Completed";
    }
    if (statusKey === "cancelled") {
      return "Cancelled";
    }
    if (statusKey === "refunded" || paymentStatus === "refunded") {
      return "Refunded";
    }
    return status;
  }, [statusKey, paymentStatus, remainingLabel, status, isPendingUnpaidExpired]);

  const badgeStyle =
    isPendingUnpaidExpired || statusKey === "cancelled"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : (statusKey === "pending" || statusKey === "processing") && paymentStatus === "unpaid"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : statusKey === "paid" || statusKey === "completed"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : statusKey === "shipped"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Order {orderNo}</h1>
          <p className="text-sm text-[var(--foreground)]/70">
            {placedAt ? new Date(placedAt).toLocaleString() : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
            {displayStatus}
          </span>
          <span className="rounded-full bg-[var(--muted)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
            {paymentStatus}
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
