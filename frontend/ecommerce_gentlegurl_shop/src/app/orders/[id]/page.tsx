import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOrderDetail } from "@/lib/server/getOrderDetail";
import { getUser } from "@/lib/server/getUser";

type OrderPageProps = {
  params: { id: string };
};

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const order = await getOrderDetail(params.id);

  if (!order) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order Detail</h1>
          <p className="text-sm text-gray-600">Order #{order.order_no}</p>
        </div>
        <Link href="/orders" className="text-blue-600 hover:underline text-sm">
          Back to Orders
        </Link>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Order Information</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-gray-500">Status</div>
              <div className="font-medium">{order.status}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Payment Status</div>
              <div className="font-medium">{order.payment_status}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Created At</div>
              <div className="font-medium">{new Date(order.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Subtotal</div>
              <div className="font-medium">{order.subtotal ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Discount</div>
              <div className="font-medium">{order.discount_total ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Shipping Fee</div>
              <div className="font-medium">{order.shipping_fee ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Grand Total</div>
              <div className="font-medium">{order.grand_total ?? "-"}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Items</h2>
          {order.items && order.items.length > 0 ? (
            <div className="mt-3 divide-y divide-gray-200">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 gap-3 py-3 text-sm sm:grid-cols-5">
                  <div className="sm:col-span-2 font-medium text-gray-900">
                    {item.name}
                  </div>
                  <div className="text-gray-600">SKU: {item.sku}</div>
                  <div className="text-gray-600">Qty: {item.quantity}</div>
                  <div className="text-gray-900">
                    {item.unit_price} ({item.line_total})
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-600">No items found.</p>
          )}
        </section>

        {order.voucher && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold">Voucher</h2>
            <p className="mt-2 text-sm text-gray-700">
              Voucher: {order.voucher.code} (-{order.voucher.discount_amount})
            </p>
          </section>
        )}

        {order.slips && order.slips.length > 0 && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold">Payment Slip</h2>
            <ul className="mt-3 space-y-2 text-sm text-blue-600">
              {order.slips.map((slip) => (
                <li key={slip.id}>
                  <a
                    href={slip.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    View Payment Slip
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {order.returns && order.returns.length > 0 && (
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold">Returns</h2>
            <div className="mt-3 space-y-3 text-sm text-gray-700">
              {order.returns.map((ret) => (
                <div key={ret.id} className="rounded border p-3">
                  <div className="font-medium">Return #{ret.id}</div>
                  <div>Status: {ret.status}</div>
                  {ret.tracking_no && <div>Tracking No: {ret.tracking_no}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
