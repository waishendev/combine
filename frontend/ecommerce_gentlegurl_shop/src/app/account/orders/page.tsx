import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrders } from "@/lib/server/getOrders";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  shipped: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function AccountOrdersPage() {
  const ordersResult = await getOrders();

  if (!ordersResult) {
    redirect("/login");
  }

  const orders = ordersResult.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Orders</h2>
          <p className="text-sm text-[var(--foreground)]/70">Review your recent purchases and their status.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[var(--muted)] bg-[var(--background)] p-10 text-center shadow-sm">
          <p className="mb-3 text-lg font-semibold text-[var(--foreground)]">You have no orders yet.</p>
          <p className="mb-4 text-sm text-[var(--foreground)]/70">Browse our catalog to start your shopping journey.</p>
          <Link
            href="/shop"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
          >
            Go Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusKey = (order.status || "").toLowerCase();
            const badgeStyle = statusStyles[statusKey] ?? "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
            return (
              <div
                key={order.id}
                className="rounded-xl border border-[var(--muted)] bg-[var(--background)] p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.08em] text-[var(--foreground)]/60">Order No</p>
                    <p className="text-lg font-semibold text-[var(--foreground)]">{order.order_no}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
                      {order.status}
                    </span>
                    <span className="rounded-full bg-[var(--muted)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
                      {order.payment_status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Date</p>
                    <p className="text-base font-medium text-[var(--foreground)]">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Payment</p>
                    <p className="text-base font-medium text-[var(--foreground)]">{order.payment_status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Total Amount</p>
                    <p className="text-base font-semibold text-[var(--accent-strong)]">{order.grand_total}</p>
                  </div>
                  <div className="flex items-end justify-start sm:justify-end">
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/60"
                    >
                      View Details
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 6.75 4.5 4.5-4.5 4.5" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
