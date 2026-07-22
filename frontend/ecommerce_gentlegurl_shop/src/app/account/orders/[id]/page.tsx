import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getOrderDetail } from "@/lib/server/getOrderDetail";
import { OrderHeaderClient } from "./OrderHeaderClient";
import { ReturnRequestButton } from "./ReturnRequestButton";
import { getOrderItemDisplayImage } from "@/lib/productMedia";

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

const resolveServicePhotoUrl = (photo: { image_url?: string | null; image_path?: string | null }) => {
  const path = photo.image_url || photo.image_path || '';
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
};


const formatOptionPrice = (value?: number | string | null) => `RM ${Number(value ?? 0).toFixed(2)}`;

function BookingProductOptionsList({
  options,
}: {
  options: Array<{ id?: number; label?: string | null; cn_label?: string | null; extra_price?: number | string | null }>;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mt-2 max-w-xl text-xs text-[var(--foreground)]/70">
      <p className="font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Options:</p>
      <ul className="mt-1 space-y-1">
        {options.map((option, index) => (
          <li key={`${option.id ?? option.label ?? index}`} className="flex items-start justify-between gap-4">
            <span className="min-w-0 flex-1">
              <span className="text-[var(--foreground)]">- {option.label || 'Option'}</span>
              {option.cn_label ? <span className="text-[var(--foreground)]/60"> / {option.cn_label}</span> : null}
            </span>
            <span className="shrink-0 font-semibold text-[var(--foreground)]">+{formatOptionPrice(option.extra_price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const resolveOrderItemLabel = (item: { line_type?: string | null; name?: string }) => {
  const lineType = String(item.line_type ?? "").toLowerCase();
  if (lineType === "booking_addon") return `Add-on - ${item.name || "Add-on"}`;
  if (lineType === "booking_deposit") return item.name || "Booking Deposit";
  if (lineType === "booking_settlement") return item.name || "Final Settlement";
  if (lineType === "service_package") return item.name || "Service Package";
  return item.name || "Item";
};


import { NameStack, VariantNameBlock } from "@/components/common/NameStack";

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
  const resolvedOrderId = order.id ?? orderId;
  const invoiceUrl = `/api/proxy/public/shop/orders/${resolvedOrderId}/invoice`;
  const returnWindowDays = order.return_window_days ?? 7;
  const hasReturnRequest = (order.returns?.length ?? 0) > 0;
  const returnRequestId = order.returns?.[0]?.id;
  const canRequestReturn = isCompleted && isWithinReturnWindow(order.completed_at, returnWindowDays);
  const refundRows = (order.refunds ?? []).filter((row) => Number(row.amount ?? 0) > 0);

  return (
    <div className="space-y-6">
      <OrderHeaderClient
        orderId={resolvedOrderId}
        orderNo={order.order_no}
        placedAt={order.placed_at}
        status={order.status}
        paymentStatus={order.payment_status}
        paymentMethod={order.payment_method}
        reserveExpiresAt={order.reserve_expires_at ?? null}
      />

      {(isCompleted || hasReturnRequest) && (
        <div className="flex flex-wrap items-center justify-start gap-3">
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
                <ReturnRequestButton orderId={resolvedOrderId} />
              ) : (
                <span className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm">
                  Return window expired
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Items</h2>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => {
              const bookingProductOptions = (item.selected_booking_product_options ?? []).flatMap((group) => group.options ?? []);
              const itemImage = getOrderItemDisplayImage(item);

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                      {itemImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={itemImage}
                          alt={item.name ?? "Item image"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/images/placeholder.png"
                          alt="No image"
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <NameStack name={resolveOrderItemLabel(item)} cnName={item.cn_name} />
                      {(item.product_type === "variant" || item.product_variant_id) && (
                        <VariantNameBlock
                          label="Variant"
                          name={item.variant_name ?? "—"}
                          cnName={item.variant_cn_name}
                        />
                      )}
                      {item.line_type === "service" ? (
                        <p className="text-xs font-medium text-emerald-700">Covered by Package</p>
                      ) : null}
                      <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity}</p>
                      {item.is_refunded ? (
                        <p className="text-xs font-semibold text-rose-600">
                          Refunded{item.refunded_quantity ? ` × ${item.refunded_quantity}` : ""}
                        </p>
                      ) : null}
                      <BookingProductOptionsList options={bookingProductOptions} />
                    </div>
                  </div>
                  <div className="w-full shrink-0 text-left text-sm text-[var(--foreground)] sm:w-auto sm:text-right">
                    <p>Unit: {item.unit_price}</p>
                    <p className="font-semibold text-[var(--accent-strong)]">Total: {item.line_total}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
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
      </div>

      {(order.service_photos?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Related Booking Service Photos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {(order.service_photos ?? []).map((photo, index) => {
              const url = resolveServicePhotoUrl(photo);
              return (
                <a key={`order-service-photo-${photo.id}`} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={photo.caption || `Related booking service photo ${index + 1}`} className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center p-2 text-center text-xs text-[var(--foreground)]/60">Image unavailable</span>
                  )}
                  {photo.caption ? <span className="block truncate px-2 py-1 text-xs text-[var(--foreground)]/60">{photo.caption}</span> : null}
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
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
              {order.shipping_address?.phone && <p>Phone: {order.shipping_address.phone}</p>}

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
                  {order.shipping_tracking_no && <p>Tracking: {order.shipping_tracking_no}</p>}
                  {order.shipped_at && <p>Shipped At: {formatDateTime(order.shipped_at)}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Billing Address</h3>
          <div className="mt-2 text-sm text-[var(--foreground)]/80">
            <p className="font-semibold text-[var(--foreground)]">
              {order.billing_address?.name ?? "-"}
            </p>
            {order.billing_address?.line1 && <p>{order.billing_address.line1}</p>}
            {order.billing_address?.line2 && <p>{order.billing_address.line2}</p>}
            {(order.billing_address?.postcode ||
              order.billing_address?.city ||
              order.billing_address?.state) && (
              <p>
                {order.billing_address?.postcode} {order.billing_address?.city},{" "}
                {order.billing_address?.state}
              </p>
            )}
            {order.billing_address?.country && <p>{order.billing_address.country}</p>}
            {order.billing_address?.phone && <p>Phone: {order.billing_address.phone}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
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
                {/* {order.bank_account.branch && <p>Branch: {order.bank_account.branch}</p>} */}
              </div>
            )}
          </div>
        </div>

        {receiptSlip?.file_url && (
          <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--myorder-background)] p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Receipt</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]/80">
              <a
                href={receiptSlip.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block overflow-hidden rounded-xl"
              >
                <Image
                  src={receiptSlip.file_url}
                  alt={`Payment slip for order ${order.order_no}`}
                  width={640}
                  height={800}
                  className="h-44 w-auto rounded-xl border border-[var(--card-border)] object-contain transition-transform duration-200 hover:scale-105"
                  unoptimized
                />
              </a>
            </div>
          </div>
        )}
      </div>

      {refundRows.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-rose-800">Refunds</h3>
          <div className="mt-3 space-y-2">
            {refundRows.map((refund) => {
              const refundUrl = refund.receipt_public_url || null;
              const label = refund.method_label || (refund.is_void_refund ? "VOID REFUND" : "Refund");
              return (
                <div
                  key={`refund-${refund.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-700">
                      {label} · -RM {Number(refund.amount ?? 0).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--foreground)]/60">
                      {[refund.refund_no, formatDateTime(refund.processed_at ?? refund.created_at)].filter(Boolean).join(" · ")}
                    </p>
                    {refund.remark ? (
                      <p className="mt-0.5 text-xs text-[var(--foreground)]/60">{refund.remark}</p>
                    ) : null}
                  </div>
                  {refundUrl ? (
                    <a
                      href={refundUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold uppercase text-rose-700 transition hover:border-rose-500 hover:text-rose-800"
                    >
                      View Receipt
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
