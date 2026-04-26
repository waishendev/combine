"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getMyEcommerceOrders, PublicAccountOrder } from "@/lib/apiClient";
import { useEffect } from "react";

function money(amount: number | null | undefined) {
  return `RM ${Number(amount ?? 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function resolveLineLabel(item: NonNullable<PublicAccountOrder["items"]>[number]) {
  const lineType = String(item.line_type ?? "").toLowerCase();
  if (lineType === "booking_addon") return `Booking Add-on Deposit - ${item.name || "Add-on"}`;
  if (lineType === "booking_deposit") return item.name || "Booking Deposit";
  if (lineType === "booking_settlement") return item.name || "Final Settlement";
  if (lineType === "service_package") return item.name || "Service Package";
  return item.name || "Item";
}

export default function BookingAccountOrdersPage() {
  const [orders, setOrders] = useState<PublicAccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const rows = await getMyEcommerceOrders();
        if (!cancelled) {
          setOrders(rows ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load your orders.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Orders</h2>
          <p className="text-sm text-[var(--foreground)]/70">
            Your ecommerce online orders are shown here with full item details.
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-[var(--foreground)]/70">Loading your orders...</p> : null}
      {error ? (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {error}
        </div>
      ) : null}

      {!loading && !hasOrders ? (
        <div className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[var(--muted)] bg-[var(--background)] p-10 text-center shadow-sm">
          <p className="mb-3 text-lg font-semibold text-[var(--foreground)]">You have no ecommerce orders yet.</p>
          <p className="mb-4 text-sm text-[var(--foreground)]/70">Try placing an online order to see it here.</p>
          <Link
            href="/"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
          >
            Shop Now
          </Link>
        </div>
      ) : null}

      {!loading && hasOrders ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusKey = (order.status || "").toLowerCase();
            const paymentStatusKey = (order.payment_status || "").toLowerCase();
            const badgeStyle =
              statusKey === "cancelled" || paymentStatusKey === "failed"
                ? "bg-[var(--status-error-bg)] text-[color:var(--status-error)] border-[var(--status-error-border)]"
                : paymentStatusKey === "paid"
                  ? "bg-[var(--status-success-bg)] text-[color:var(--status-success)] border-[var(--status-success-border)]"
                  : "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[var(--status-warning-border)]";

            const isExpanded = expandedOrderId === order.id;
            const invoiceUrl = `/api/proxy/public/shop/orders/${order.id}/invoice`;
            const receiptUrl = order.receipt_public_url ? `${order.receipt_public_url}/invoice` : null;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-[var(--muted)] bg-[var(--myorder-background)] p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--foreground)]">Order No:</p>
                    <p className="text-sm tracking-[0.08em] text-[var(--foreground)]/60">{order.order_no}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
                    {order.status} / {order.payment_status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Date</p>
                    <p className="text-base font-medium text-[var(--foreground)]">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Payment</p>
                    <p className="text-base font-medium text-[var(--foreground)]">{order.payment_status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Total Amount</p>
                    <p className="text-base font-semibold text-[var(--accent-strong)]">{money(order.grand_total)}</p>
                  </div>

                  <div className="sm:col-span-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                      {receiptUrl ? (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                        >
                          View Receipt
                        </a>
                      ) : null}
                      {paymentStatusKey === "paid" ? (
                        <a
                          href={invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                        >
                          Download Invoice
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {isExpanded && Array.isArray(order.items) && order.items.length > 0 ? (
                    <div className="sm:col-span-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Items</p>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--muted)] bg-[var(--myorder-background)] px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">{resolveLineLabel(item)}</p>
                              {item.line_type === "service" ? (
                                <p className="text-xs font-medium text-emerald-700">Covered by Package</p>
                              ) : null}
                              <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity ?? 1}</p>
                            </div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{money(item.line_total)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
