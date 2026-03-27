"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getMyOrders, type PublicAccountOrder } from "@/lib/apiClient";

function formatOrderType(order: PublicAccountOrder) {
  const lineTypes = new Set((order.items ?? []).map((item) => String(item.line_type || "").toLowerCase()));
  const hasBooking = lineTypes.has("booking_deposit") || lineTypes.has("booking_settlement");
  const hasPackage = lineTypes.has("service_package");

  if (hasBooking && hasPackage) return "Booking + Package";
  if (hasPackage) return "Package Purchase";
  if (hasBooking) return "Booking Deposit";
  return "Order";
}

export default function AccountOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PublicAccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getMe();
      } catch {
        if (mounted) {
          router.push("/login?redirect=/account/orders");
        }
        return;
      }

      try {
        const rows = await getMyOrders();
        if (mounted) {
          const bookingOrders = rows.filter((order) =>
            (order.items ?? []).some((item) =>
              ["booking_deposit", "booking_settlement", "service_package"].includes(String(item.line_type || "")),
            ),
          );
          setOrders(bookingOrders);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load my orders");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const hasOrders = useMemo(() => orders.length > 0, [orders.length]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My Orders</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Payment and receipt history for booking deposits, package purchases, and mixed carts.</p>
      </div>

      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading orders...</p> : null}
      {error ? <p className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[var(--status-error)]">{error}</p> : null}

      {!loading && !error && !hasOrders ? (
        <div className="rounded-2xl border border-dashed border-[var(--card-border)] p-5 text-sm text-[var(--text-muted)]">
          No booking-related orders yet.
        </div>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Order / Receipt</p>
                <p className="font-semibold">{order.order_no || `#${order.id}`}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{order.created_at ? new Date(order.created_at).toLocaleString("en-MY") : "-"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Total Paid</p>
                <p className="text-lg font-semibold">RM {Number(order.grand_total ?? 0).toFixed(2)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Payment: {order.payment_status}</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-[var(--background-soft)] px-3 py-2 text-sm text-[var(--foreground)]/80">
              Type: <span className="font-medium">{formatOrderType(order)}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/payment-result?order_id=${order.id}&order_no=${encodeURIComponent(order.order_no || "")}`}
                className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)]/40"
              >
                View Order
              </Link>
              <a
                href={`/api/proxy/public/shop/orders/${order.id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm hover:bg-[var(--muted)]/40"
              >
                View Receipt
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
