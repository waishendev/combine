import Link from "next/link";
import { OrderPaymentActions } from "@/components/account/OrderActions";
import { requireCustomer } from "@/lib/require-auth";
import { fetchMyOrderDetail } from "@/lib/shop-api";

export default async function ThankYouPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  await requireCustomer(`/orders/${orderNo}/thank-you`);
  const res = await fetchMyOrderDetail(orderNo);
  const order = res.data;
  const canPayAgain = order.payment_method === "billplz_fpx" && order.payment_status === "unpaid";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm uppercase text-blue-700">Order received</p>
      <h1 className="text-3xl font-semibold">Thank you for your purchase!</h1>
      <p className="mt-3 text-slate-700">Order number: {order.order_no}</p>
      <div className="mt-4 inline-flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-slate-500">Status</span>
        <span className="font-semibold">{order.status}</span>
        <span className="text-slate-500">Payment</span>
        <span className="font-semibold">{order.payment_status}</span>
      </div>
      <div className="mt-6 space-y-2 text-slate-600">
        <p>We have received your order and will process it shortly.</p>
        {order.payment_method === "manual_transfer" && order.payment_status === "unpaid" ? (
          <p>
            Please complete the manual transfer and upload your receipt in
            <Link href={`/account/orders/${order.order_no}`} className="ml-1 font-semibold text-blue-600 underline">
              your order details
            </Link>
            .
          </p>
        ) : (
          <p>You will receive updates once your items are shipped.</p>
        )}
      </div>
      {canPayAgain ? (
        <div className="mt-6 flex justify-center">
          <OrderPaymentActions orderNo={order.order_no} canPayAgain={canPayAgain} />
        </div>
      ) : null}
      <div className="mt-6 text-sm text-blue-700">
        <Link href={`/account/orders/${order.order_no}`} className="underline">
          View order details
        </Link>
      </div>
    </section>
  );
}
