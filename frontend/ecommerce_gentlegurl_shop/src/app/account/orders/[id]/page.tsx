import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getOrderDetail } from "@/lib/server/getOrderDetail";
import { OrderHeaderClient } from "./OrderHeaderClient";
import { ReturnRequestButton } from "./ReturnRequestButton";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toLocaleString();
};

const isWithinReturnWindow = (completedAt?: string | null, windowDays?: number | null) => {
  if (!completedAt || !windowDays) return false;
  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) return false;
  const windowEnds = new Date(completedDate);
  windowEnds.setDate(windowEnds.getDate() + windowDays);
  return windowEnds.getTime() >= Date.now();
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const orderId = Number(id);
  const order = await getOrderDetail(orderId);

  if (!order) {
    redirect("/login");
  }

  if (!orderId || !order) {
    return notFound();
  }

  const receiptSlip = order.slips?.find((slip) => slip.type === "payment_slip") ?? null;
  const isCompleted = order.status === "completed";
  const invoiceUrl = `/api/proxy/public/shop/orders/${order.id}/invoice`;
  const returnWindowDays = order.return_window_days ?? 7;
  const hasReturnRequest = (order.returns?.length ?? 0) > 0;
  const returnRequestId = order.returns?.[0]?.id;
  const canRequestReturn = isCompleted && isWithinReturnWindow(order.completed_at, returnWindowDays);

  return (
    <div className="space-y-6">
      <OrderHeaderClient
        orderId={order.id}
        orderNo={order.order_no}
        placedAt={order.placed_at}
        status={order.status}
        paymentStatus={order.payment_status}
        paymentMethod={order.payment_method}
        reserveExpiresAt={order.reserve_expires_at ?? null}
      />

      {(isCompleted || hasReturnRequest) && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isCompleted && (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
            >
              Download Invoice
            </a>
          )}

          {hasReturnRequest && returnRequestId && (
            <Link
              href={`/account/returns/${returnRequestId}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--foreground)]/20 px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/40"
            >
              View Return
            </Link>
          )}

          {!hasReturnRequest && isCompleted && (
            <div className="flex flex-col items-end gap-2 text-sm text-[var(--foreground)]/70">
              {canRequestReturn ? (
                <ReturnRequestButton orderId={order.id} />
              ) : (
                <span className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm">
                  Return window expired
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Items</h2>
        <div className="mt-3 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {item.product_image ? ( 
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product_image}
                    alt={item.name ?? "Product image"}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-[var(--muted)]" />
                )}
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                  <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity}</p>
                </div>
              </div>
              <div className="w-full text-left text-sm text-[var(--foreground)] sm:w-auto sm:text-right">
                <p>Unit: {item.unit_price}</p>
                <p className="font-semibold text-[var(--accent-strong)]">Total: {item.line_total}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Totals</h3>
          <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]/80">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{order.subtotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <span>{order.discount_total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>{order.shipping_fee}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-[var(--accent-strong)]">
              <span>Grand Total</span>
              <span>{order.grand_total}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {order.pickup_or_shipping === "self_pickup" ? "Pickup" : "Shipping Information"}
          </h3>
           {order.pickup_or_shipping === "self_pickup" && order.pickup_store ? (
            <div className="mt-2 text-sm text-[var(--foreground)]/80">
              <p className="font-semibold text-[var(--foreground)]">{order.pickup_store.name}</p>
              <p>{order.pickup_store.address_line1}</p>
              {order.pickup_store.address_line2 && <p>{order.pickup_store.address_line2}</p>}
              <p>
                {order.pickup_store.postcode} {order.pickup_store.city}, {order.pickup_store.state}
              </p>
              <p>{order.pickup_store.country}</p>
              {order.pickup_store.phone && <p>Phone: {order.pickup_store.phone}</p>}
            </div>
          ) : (
                <div className="mt-2 text-sm text-[var(--foreground)]/80">
                  {/* Address */}
                  <p className="font-semibold text-[var(--foreground)]">
                    {order.shipping_address?.name}
                  </p>
                  <p>{order.shipping_address?.line1}</p>
                  {order.shipping_address?.line2 && <p>{order.shipping_address.line2}</p>}
                  <p>
                    {order.shipping_address?.postcode} {order.shipping_address?.city},{" "}
                    {order.shipping_address?.state}
                  </p>
                  <p>{order.shipping_address?.country}</p>
                  {order.shipping_address?.phone && (
                    <p>Phone: {order.shipping_address.phone}</p>
                  )}

                  {/* Divider */}
                  {(order.shipping_courier || order.shipping_tracking_no || order.shipped_at) && (
                    <div className="my-3 border-t border-[var(--card-border)]" />
                  )}

                  {/* Logistics */}
                  {(order.shipping_courier || order.shipping_tracking_no || order.shipped_at) && (
                    <div className="space-y-1 text-xs text-[var(--foreground)]/70">
                      <p className="font-semibold uppercase tracking-wide text-[var(--foreground)]/80">
                        Logistics
                      </p>
                      {order.shipping_courier && <p>Courier: {order.shipping_courier}</p>}
                      {order.shipping_tracking_no && (
                        <p>Tracking: {order.shipping_tracking_no}</p>
                      )}
                      {order.shipped_at && (
                        <p>Shipped At: {formatDateTime(order.shipped_at)}</p>
                      )}
                    </div>
                  )}
                </div>

          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Billing Address</h3>
          <div className="mt-2 text-sm text-[var(--foreground)]/80">
            <p className="font-semibold text-[var(--foreground)]">
              {order.billing_address?.name ?? "-"}
            </p>
            {order.billing_address?.line1 && <p>{order.billing_address.line1}</p>}
            {order.billing_address?.line2 && <p>{order.billing_address.line2}</p>}
            {(order.billing_address?.postcode || order.billing_address?.city || order.billing_address?.state) && (
              <p>
                {order.billing_address?.postcode} {order.billing_address?.city}, {order.billing_address?.state}
              </p>
            )}
            {order.billing_address?.country && <p>{order.billing_address.country}</p>}
            {order.billing_address?.phone && <p>Phone: {order.billing_address.phone}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Payment</h3>
          <div className="mt-2 text-sm text-[var(--foreground)]/80">
            <p>Method: {order.payment_method ?? "N/A"}</p>
            <p>Status: {order.payment_status}</p>
            {order.bank_account && (
              <div className="mt-2 space-y-1">
                <p className="font-semibold">Bank Account</p>
                <p>
                  {order.bank_account.bank_name} — {order.bank_account.account_name}
                </p>
                <p>Account No: {order.bank_account.account_number}</p>
                {order.bank_account.branch && <p>Branch: {order.bank_account.branch}</p>}
              </div>
            )}
          </div>
        </div>

        {receiptSlip?.file_url && (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Receipt</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]/80">
              <a href={receiptSlip.file_url} target="_blank" rel="noreferrer">
                <Image
                  src={receiptSlip.file_url}
                  alt={`Payment slip for order ${order.order_no}`}
                  width={640}
                  height={800}
                  className="h-auto w-full rounded-xl border border-[var(--card-border)] object-contain"
                  unoptimized
                />
              </a>
            </div>
          </div>
        )}

        {order.returns && order.returns.length > 0 && (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Returns</h3>
            <div className="mt-2 space-y-2 text-sm text-[var(--foreground)]/80">
              {order.returns.map((returnReq) => (
                <div key={returnReq.id} className="rounded-lg border border-[var(--card-border)] px-3 py-2">
                  <p className="font-semibold">Return #{returnReq.id}</p>
                  <p>Status: {returnReq.status}</p>
                  {returnReq.tracking_no && <p>Tracking: {returnReq.tracking_no}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
