import Link from "next/link";
import { redirect } from "next/navigation";
import { OrdersClient } from "./OrdersClient";
import { getOrders } from "@/lib/server/getOrders";

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
        <OrdersClient orders={orders} />
      )}
    </div>
  );
}
