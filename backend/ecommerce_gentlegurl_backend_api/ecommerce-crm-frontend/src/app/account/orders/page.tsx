import Link from "next/link";
import { fetchMyOrders } from "@/lib/shop-api";
import type { OrderSummary } from "@/lib/shop-types";
import { requireCustomer } from "@/lib/require-auth";

export default async function AccountOrdersPage() {
  await requireCustomer("/account/orders");
  const res = await fetchMyOrders({ page: 1 });
  const orders: OrderSummary[] = res.data;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Your orders</h2>
      {!orders.length ? (
        <p className="text-sm text-slate-600">No orders yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_no} className="border-t">
                  <td className="px-4 py-3 font-semibold">{order.order_no}</td>
                  <td className="px-4 py-3 text-slate-600">{order.placed_at || "-"}</td>
                  <td className="px-4 py-3 text-slate-800">{order.status}</td>
                  <td className="px-4 py-3 text-slate-800">{order.payment_status}</td>
                  <td className="px-4 py-3 text-right font-semibold">RM {order.grand_total}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/account/orders/${order.order_no}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
