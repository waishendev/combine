"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cancelOrder,
  getMyOrders,
  payPublicOrder,
  PublicAccountOrder,
} from "@/lib/apiClient";
import UploadReceiptModal from "@/components/orders/UploadReceiptModal";
import { formatOrderPaymentMethodsLabel } from "@/lib/orderPaymentDisplay";
import { getOrderItemDisplayImage } from "@/lib/orderItemImage";

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
              <span className="text-[var(--foreground)]">- {option.label || "Option"}</span>
              {option.cn_label ? <span className="text-[var(--foreground)]/60"> / {option.cn_label}</span> : null}
            </span>
            <span className="shrink-0 font-semibold text-[var(--foreground)]">{money(Number(option.extra_price ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function resolveLineLabel(item: NonNullable<PublicAccountOrder["items"]>[number]) {
  const lineType = String(item.line_type ?? "").toLowerCase();
  if (lineType === "booking_addon") return `Booking Add-on Deposit - ${item.name || "Add-on"}`;
  if (lineType === "booking_deposit") return item.name || "Booking Deposit";
  if (lineType === "booking_settlement") return item.name || "Final Settlement";
  if (lineType === "service_package") return item.name || "Service Package";
  return item.name || "Item";
}

function LineNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="line-clamp-2 text-sm font-semibold text-[var(--foreground)]">{name}</p>
      {cnName ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--foreground)]/60">{cnName}</p> : null}
    </>
  );
}

type SlipModalState = {
  orderId: number;
};

export function BookingTransactionsClient() {
  const [orders, setOrders] = useState<PublicAccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderOverrides, setOrderOverrides] = useState<Record<number, { status?: string; payment_status?: string }>>({});
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [slipModal, setSlipModal] = useState<SlipModalState | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const rows = await getMyOrders();
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function reloadOrders() {
    const rows = await getMyOrders();
    setOrders(rows ?? []);
  }

  async function handleCancel(orderId: number) {
    setCancelError(null);
    setCancellingOrderId(orderId);
    try {
      const response = await cancelOrder(orderId);
      setOrderOverrides((prev) => ({
        ...prev,
        [orderId]: {
          status: response.order.status,
          payment_status: response.order.payment_status,
        },
      }));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Unable to cancel this order.");
    } finally {
      setCancellingOrderId(null);
    }
  }

  async function handlePayNow(orderId: number, paymentMethod?: string | null) {
    setPaymentError(null);

    if (paymentMethod === "manual_transfer") {
      setSlipModal({ orderId });
      return;
    }

    if (!paymentMethod?.startsWith("billplz_")) {
      setPaymentError("Payment method is not supported.");
      return;
    }

    setPayingOrderId(orderId);
    try {
      const response = await payPublicOrder(orderId);
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        setPaymentError("Unable to initiate payment.");
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to initiate payment.");
    } finally {
      setPayingOrderId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--foreground)]/70">Loading your transactions...</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start justify-center rounded-xl border border-dashed border-[var(--muted)] bg-[var(--background)] p-10 text-center shadow-sm">
        <p className="mb-3 text-lg font-semibold text-[var(--foreground)]">You have no transactions yet.</p>
        <p className="mb-4 text-sm text-[var(--foreground)]/70">Try placing a booking or package order to see it here.</p>
        <Link
          href="/booking"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
        >
          Start Booking
        </Link>
      </div>
    );
  }

  return (
    <>
      {cancelError ? (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {cancelError}
        </div>
      ) : null}
      {paymentError ? (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {paymentError}
        </div>
      ) : null}

      <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto overscroll-contain pr-1">
        {orders.map((order) => {
          const override = orderOverrides[order.id] ?? {};
          const statusValue = override.status ?? order.status;
          const paymentStatusValue = override.payment_status ?? order.payment_status;
          const statusKey = (statusValue || "").toLowerCase();
          const paymentStatusKey = (paymentStatusValue || "").toLowerCase();
          const reserveExpiresAt = order.reserve_expires_at ? new Date(order.reserve_expires_at) : null;
          const remainingSeconds = reserveExpiresAt
            ? Math.max(0, Math.floor((reserveExpiresAt.getTime() - now) / 1000))
            : null;
          const remainingLabel =
            remainingSeconds !== null
              ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`
              : null;
          const isExpired = remainingSeconds !== null && remainingSeconds === 0;
          const isPendingUnpaid = statusKey === "pending" && paymentStatusKey === "unpaid";
          const isPendingUnpaidExpired = isPendingUnpaid && isExpired;
          const isProcessing = statusKey === "processing" && paymentStatusKey === "unpaid";
          const canPay = isPendingUnpaid && !isExpired;
          const canUploadSlip = order.payment_method === "manual_transfer" && (isPendingUnpaid || isProcessing);
          const isExpanded = expandedOrderId === order.id;
          const receiptUrl =
            paymentStatusKey === "paid" && order.receipt_public_url
              ? `${order.receipt_public_url}/invoice`
              : null;

          let displayStatus: string;
          if (statusKey === "cancelled" || isPendingUnpaidExpired) {
            displayStatus = "Cancelled";
          } else if (paymentStatusKey === "failed") {
            displayStatus = "Payment Failed";
          } else if (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid") {
            displayStatus = "Payment Proof Rejected";
          } else if (statusKey === "pending" && paymentStatusKey === "unpaid") {
            displayStatus = `Awaiting Payment${remainingLabel !== null ? ` (${remainingLabel} left)` : ""}`;
          } else if (statusKey === "processing" && paymentStatusKey === "unpaid") {
            displayStatus = "Waiting for Verification";
          } else if (statusKey === "confirmed" && paymentStatusKey === "paid") {
            displayStatus = "Payment Confirmed";
          } else if (statusKey === "processing" && paymentStatusKey === "paid") {
            displayStatus = "Preparing";
          } else if (statusKey === "completed") {
            displayStatus = "Completed";
          } else {
            displayStatus = statusValue;
          }

          let badgeStyle: string;
          if (
            statusKey === "cancelled" ||
            isPendingUnpaidExpired ||
            paymentStatusKey === "failed" ||
            (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid")
          ) {
            badgeStyle =
              "bg-[var(--status-error-bg)] text-[color:var(--status-error)] border-[var(--status-error-border)]";
          } else if (
            (statusKey === "pending" && paymentStatusKey === "unpaid") ||
            (statusKey === "processing" && paymentStatusKey === "unpaid")
          ) {
            badgeStyle =
              "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[var(--status-warning-border)]";
          } else if (
            (statusKey === "confirmed" && paymentStatusKey === "paid") ||
            (statusKey === "processing" && paymentStatusKey === "paid") ||
            statusKey === "completed"
          ) {
            badgeStyle =
              "bg-[var(--status-success-bg)] text-[color:var(--status-success)] border-[var(--status-success-border)]";
          } else {
            badgeStyle = "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
          }

          return (
            <div
              key={order.id}
              className="rounded-xl border border-[var(--muted)] bg-[var(--myorder-background)] p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-[var(--foreground)]">Order No:</p>
                  <p className="truncate text-sm tracking-[0.08em] text-[var(--foreground)]/60">{order.order_no}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
                  {displayStatus}
                </span>
              </div>

              <div className="mt-4 grid min-w-0 gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Date</p>
                  <p className="text-base font-medium text-[var(--foreground)]">{formatDate(order.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Payment</p>
                  <div className="text-base font-medium text-[var(--foreground)]">
                    <p>{paymentStatusValue}</p>
                    <p className="mt-1 text-xs text-[var(--foreground)]/70">
                      {formatOrderPaymentMethodsLabel(order)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Total Amount</p>
                  <p className="text-base font-semibold text-[var(--accent-strong)]">{money(order.grand_total)}</p>
                </div>

                <div className="sm:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {canPay ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePayNow(order.id, order.payment_method)}
                          disabled={payingOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {payingOrderId === order.id ? "Redirecting..." : "Pay Now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(order.id)}
                          disabled={cancellingOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--status-error-border)] px-4 py-2 text-xs font-semibold uppercase text-[color:var(--status-error)] transition hover:border-[var(--status-error)] hover:bg-[var(--status-error-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {cancellingOrderId === order.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </>
                    ) : null}
                    {!canPay && isProcessing && canUploadSlip ? (
                      <button
                        type="button"
                        onClick={() => setSlipModal({ orderId: order.id })}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                      >
                        Reupload Slip
                      </button>
                    ) : null}
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
                  </div>
                </div>

                {isExpanded && Array.isArray(order.items) && order.items.length > 0 ? (
                  <div className="sm:col-span-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Items</p>
                    <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {order.items.map((item) => {
                        const bookingProductOptions = (item.selected_booking_product_options ?? []).flatMap(
                          (group) => group.options ?? [],
                        );
                        const itemImage = getOrderItemDisplayImage(item);
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--muted)] bg-[var(--myorder-background)] px-3 py-2"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
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
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <LineNameStack name={resolveLineLabel(item)} cnName={item.cn_name} />
                                {(item.product_type === "variant" || item.product_variant_id) && (
                                  <div className="mt-1">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--foreground)]/50">Variant</p>
                                    <p className="text-xs font-medium text-[var(--foreground)]">{item.variant_name ?? "—"}</p>
                                    {item.variant_cn_name ? (
                                      <p className="mt-0.5 text-[11px] text-[var(--foreground)]/60">{item.variant_cn_name}</p>
                                    ) : null}
                                  </div>
                                )}
                                {item.line_type === "service" ? (
                                  <p className="text-xs font-medium text-emerald-700">Covered by {item.package_applied_name ?? 'Package'}</p>
                                ) : item.package_applied_name ? (
                                  <p className="text-xs font-medium text-emerald-700">Covered by {item.package_applied_name}</p>
                                ) : null}
                                <BookingProductOptionsList options={bookingProductOptions} />
                                <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity ?? 1}</p>
                              </div>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-[var(--foreground)]">{money(item.line_total)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <UploadReceiptModal
        isOpen={!!slipModal}
        orderId={slipModal?.orderId ?? 0}
        onClose={() => setSlipModal(null)}
        onSuccess={() => {
          setSlipModal(null);
          void reloadOrders();
        }}
      />
    </>
  );
}
