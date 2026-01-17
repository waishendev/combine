"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderItemSummary, OrderSummary } from "@/lib/server/getOrders";
import { submitProductReview } from "@/lib/api/productReviews";
import { RatingStars } from "@/components/reviews/RatingStars";
import { cancelOrder, completeOrder, payOrder } from "@/lib/apiClient";
import OrderCompleteModal from "@/components/orders/OrderCompleteModal";
import UploadReceiptModal from "@/components/orders/UploadReceiptModal";
import { getPrimaryProductImage } from "@/lib/productMedia";

type OrdersClientProps = {
  orders: OrderSummary[];
};

type ModalState = {
  orderId: number;
  item: OrderItemSummary;
  slug: string;
};

type SlipModalState = {
  orderId: number;
};

type CompleteModalState = {
  orderId: number;
};

export function OrdersClient({ orders }: OrdersClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reviewedItems, setReviewedItems] = useState<Record<number, boolean>>({});
  const [orderOverrides, setOrderOverrides] = useState<Record<number, { status?: string; payment_status?: string }>>({});
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [slipModal, setSlipModal] = useState<SlipModalState | null>(null);
  const [completeModal, setCompleteModal] = useState<CompleteModalState | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const reviewedItemIds = useMemo(() => reviewedItems, [reviewedItems]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const closeModal = () => {
    setModal(null);
    setRating(5);
    setTitle("");
    setBody("");
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  async function handleOpenReview(orderId: number, item: OrderItemSummary) {
    if (!item.product_slug) return;

    setSubmitError(null);
    setSubmitSuccess(null);

    setModal({
      orderId,
      item,
      slug: item.product_slug,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await submitProductReview(modal.slug, {
        order_item_id: modal.item.id,
        rating,
        title: title?.trim() || null,
        body: body.trim(),
      });

      setReviewedItems((prev) => ({ ...prev, [modal.item.id]: true }));
      setSubmitSuccess("Review submitted successfully.");
      closeModal();
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Failed to submit review."
          : "Failed to submit review.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
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
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to cancel this order."
          : "Unable to cancel this order.";
      setCancelError(message);
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
      const response = await payOrder(orderId);
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        setPaymentError("Unable to initiate payment.");
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to initiate payment."
          : "Unable to initiate payment.";
      setPaymentError(message);
    } finally {
      setPayingOrderId(null);
    }
  }

  async function handleComplete(orderId: number, onSuccess?: () => void) {
    setCompleteError(null);
    setCompleteSuccess(null);

    setCompletingOrderId(orderId);
    try {
      const response = await completeOrder(orderId);
      setOrderOverrides((prev) => ({
        ...prev,
        [orderId]: {
          status: response.order.status,
          payment_status: response.order.payment_status,
          },
      }));
      setCompleteSuccess("Order marked as completed.");
      onSuccess?.();
    } catch (error) {
      const message =
        typeof error === "object" && error && "data" in (error as never)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).data?.message as string | undefined) ?? "Unable to complete this order."
          : "Unable to complete this order.";
      setCompleteError(message);
    } finally {
      setCompletingOrderId(null);
    }
  }

  return (
    <div className="space-y-4">
      {cancelError && (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {cancelError}
        </div>
      )}
      {paymentError && (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {paymentError}
        </div>
      )}
      {completeError && (
        <div className="rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error)]">
          {completeError}
        </div>
      )}
      {completeSuccess && (
        <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success)]">
          {completeSuccess}
        </div>
      )}
      {submitSuccess && (
        <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success)]">
          {submitSuccess}
        </div>
      )}

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
        const canComplete =
          (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") || statusKey === "shipped";
        const isCompleted = statusKey === "completed";
        const invoiceUrl = `/api/proxy/public/shop/orders/${order.id}/invoice`;
        
        // New status display logic based on the requirements
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
        } else if (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") {
          displayStatus = "Ready for Pickup";
        } else if (statusKey === "shipped") {
          displayStatus = "Shipped";
        } else if (statusKey === "completed") {
          displayStatus = "Completed";
        } else {
          displayStatus = statusValue;
        }

        // Badge style based on status
        let badgeStyle: string;
        if (
          statusKey === "cancelled" ||
          isPendingUnpaidExpired ||
          paymentStatusKey === "failed" ||
          (statusKey === "reject_payment_proof" && paymentStatusKey === "unpaid")
        ) {
          badgeStyle = "bg-[var(--status-error-bg)] text-[color:var(--status-error)] border-[var(--status-error-border)]";
        } else if ((statusKey === "pending" && paymentStatusKey === "unpaid") || (statusKey === "processing" && paymentStatusKey === "unpaid")) {
          badgeStyle = "bg-[var(--status-warning-bg)] text-[color:var(--status-warning-text)] border-[var(--status-warning-border)]";
        } else if ((statusKey === "confirmed" && paymentStatusKey === "paid") || (statusKey === "processing" && paymentStatusKey === "paid") || (statusKey === "ready_for_pickup" && paymentStatusKey === "paid") || statusKey === "shipped" || statusKey === "completed") {
          badgeStyle = "bg-[var(--status-success-bg)] text-[color:var(--status-success)] border-[var(--status-success-border)]";
        } else {
          badgeStyle = "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";
        }

        return (
          <div
            key={order.id}
            className="rounded-xl border border-[var(--muted)] bg-[var(--myorder-background)] p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className=" text-lg font-semibold text-[var(--foreground)]"> Order No:</p>
                <p className="text-sm tracking-[0.08em] text-[var(--foreground)]/60">{order.order_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyle}`}>
                  {displayStatus}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/80 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Date</p>
                <p className="text-base font-medium text-[var(--foreground)]">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Payment</p>
                <p className="text-base font-medium text-[var(--foreground)]">{paymentStatusValue}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Total Amount</p>
                <p className="text-base font-semibold text-[var(--accent-strong)]">{order.grand_total}</p>
              </div>

              <div className="sm:col-span-3">
                <div className="flex flex-wrap items-center gap-2">
                  {canPay && (
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
                  )}
                  {!canPay && isProcessing && canUploadSlip && (
                    <button
                      type="button"
                      onClick={() => setSlipModal({ orderId: order.id })}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                    >
                      Reupload Slip
                    </button>
                  )}
                  <Link
                    href={`/account/orders/${order.id}`}
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
                  {canComplete && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompleteError(null);
                        setCompleteSuccess(null);
                        setCompleteModal({ orderId: order.id });
                      }}
                      disabled={completingOrderId === order.id}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {completingOrderId === order.id ? "Completing..." : "Mark as Completed"}
                    </button>
                  )}
                  {isCompleted && (
                    <a
                      href={invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                    >
                      Download Invoice
                    </a>
                  )}
                </div>
              </div>

              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="sm:col-span-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Items</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {order.items.map((item) => {
                      const isReviewed = item.review_id != null || reviewedItemIds[item.id] === true;
                      const canReview = item.can_review === true;
                      const disabled = isReviewed || !item.product_slug || !canReview;
                      const shouldShowVariant = item.product_type === "variant" || !!item.product_variant_id;
                      const variantName = item.variant_name ?? "—";
                      const variantSkuSuffix = item.variant_sku ? ` (${item.variant_sku})` : "";
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--muted)] bg-[var(--myorder-background)] px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPrimaryProductImage(item)}
                              alt={item.name ?? "Product image"}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                              <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity}</p>
                              {shouldShowVariant && (
                                <p className="text-xs text-[var(--foreground)]/60">
                                  Variant: {variantName}
                                  {variantSkuSuffix}
                                </p>
                              )}
                            </div>
                          </div>
                          {(canReview || isReviewed) && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenReview(order.id, item)}
                                disabled={disabled}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  isReviewed
                                    ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[color:var(--status-success)]"
                                    : "border-[var(--accent)] text-[var(--accent)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {isReviewed ? "Reviewed" : "Write a Review"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--muted)] bg-[var(--myorder-background)] px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPrimaryProductImage(modal.item)}
                  alt={modal.item.name ?? "Product image"}
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{modal.item.name}</p>
                  <p className="text-xs text-[var(--foreground)]/70">Qty: {modal.item.quantity}</p>
                  {(modal.item.product_type === "variant" || modal.item.product_variant_id) && (
                    <p className="text-xs text-[var(--foreground)]/60">
                      Variant: {modal.item.variant_name ?? "—"}
                      {modal.item.variant_sku ? ` (${modal.item.variant_sku})` : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-[color:var(--text-muted)] hover:text-[color:var(--text-muted)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Rating</label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="w-28 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-2 text-sm"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    disabled={submitting}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} Star{value > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <RatingStars value={rating} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                  placeholder="Summarize your review"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Your Review</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="h-28 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                  placeholder="Share your experience with this product"
                  maxLength={2000}
                  required
                  disabled={submitting}
                />
              </div>

              {submitError && <p className="text-sm text-[color:var(--status-error)]">{submitError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] hover:bg-[var(--muted)]/40"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UploadReceiptModal
        isOpen={!!slipModal}
        orderId={slipModal?.orderId ?? 0}
        onClose={() => setSlipModal(null)}
        onSuccess={() => {
          setSlipModal(null);
          router.refresh();
        }}
      />
      <OrderCompleteModal
        isOpen={!!completeModal}
        isSubmitting={completingOrderId === completeModal?.orderId}
        error={completeError}
        onClose={() => setCompleteModal(null)}
        onConfirm={() => {
          if (!completeModal) return;
          handleComplete(completeModal.orderId, () => setCompleteModal(null));
        }}
      />
    </div>
  );
}
