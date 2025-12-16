import {
  OrderPaymentActions,
  ReturnRequestForm,
  UploadSlipForm,
} from "@/components/account/OrderActions";
import { requireCustomer } from "@/lib/require-auth";
import { fetchMyOrderDetail } from "@/lib/shop-api";
import type { OrderDetail } from "@/lib/shop-types";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  await requireCustomer(`/account/orders/${orderNo}`);
  const res = await fetchMyOrderDetail(orderNo);
  const order: OrderDetail = res.data;
  const canCancel = order.status === "pending" && order.payment_status === "unpaid";
  const canPayAgain = canCancel && order.payment_method === "billplz_fpx";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-blue-700">Order Detail</p>
          <h2 className="text-2xl font-semibold">Order #{order.order_no}</h2>
          <p className="text-sm text-slate-600">Placed at {order.placed_at || "-"}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <span className="font-semibold">{order.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Payment:</span>
            <span className="font-semibold">{order.payment_status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Total:</span>
            <span className="font-semibold">RM {order.grand_total}</span>
          </div>
          {order.expected_points ? (
            <div className="text-xs text-green-700">Earn {order.expected_points} pts with this order</div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Shipping / Contact</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            {order.shipping_name && <p>{order.shipping_name}</p>}
            {order.shipping_phone && <p>{order.shipping_phone}</p>}
            {order.shipping_address && <p>{order.shipping_address}</p>}
            {order.pickup_location && <p>Pickup: {order.pickup_location}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <OrderPaymentActions orderNo={order.order_no} canCancel={canCancel} canPayAgain={canPayAgain} />
          {order.payment_status === "unpaid" && order.payment_method === "manual_transfer" && (
            <UploadSlipForm orderNo={order.order_no} />
          )}
          {order.allow_return && <ReturnRequestForm orderNo={order.order_no} />}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{item.product_name}</td>
                <td className="px-4 py-3 text-slate-600">{item.sku || "-"}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">RM {item.unit_price}</td>
                <td className="px-4 py-3 text-right font-semibold">RM {item.line_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.returns?.length ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Return / Refund requests</h3>
          <div className="space-y-2 text-sm">
            {order.returns.map((ret) => (
              <div key={ret.id} className="rounded-lg border bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold uppercase text-slate-700">{ret.type}</div>
                    <div className="text-slate-600">Status: {ret.status}</div>
                  </div>
                  <a href={`/account/returns/${ret.id}`} className="text-blue-600 hover:underline">
                    View details
                  </a>
                </div>
                {ret.reason && <div className="text-slate-700">Reason: {ret.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
