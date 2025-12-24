"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OrderItemSummary, OrderSummary } from "@/lib/server/getOrders";
import {
  fetchProductReviewEligibility,
  submitProductReview,
} from "@/lib/api/productReviews";
import { RatingStars } from "@/components/reviews/RatingStars";

type OrdersClientProps = {
  orders: OrderSummary[];
};

type ModalState = {
  orderId: number;
  item: OrderItemSummary;
  slug: string;
};

const reasonMessages: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to write a review.",
  NOT_PURCHASED: "Only customers who purchased this product can review.",
  ORDER_NOT_COMPLETED: "You can review after the order is completed.",
  REVIEW_WINDOW_EXPIRED: "Review period expired.",
  ALREADY_REVIEWED: "You have already reviewed this product.",
  REVIEWS_DISABLED: "Reviews are disabled.",
};

export function OrdersClient({ orders }: OrdersClientProps) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reviewedItems, setReviewedItems] = useState<Record<number, boolean>>({});

  const reviewedItemIds = useMemo(() => reviewedItems, [reviewedItems]);

  const closeModal = () => {
    setModal(null);
    setRating(5);
    setTitle("");
    setBody("");
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  async function handleOpenReview(orderId: number, item: OrderItemSummary) {
    if (!item.product_slug) {
      setEligibilityError("Product slug not available for review.");
      return;
    }

    setEligibilityError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    setEligibilityLoading(true);

    try {
      const eligibility = await fetchProductReviewEligibility(item.product_slug);

      if (!eligibility) {
        setEligibilityError("Unable to check review eligibility. Please try again.");
        return;
      }

      if (!eligibility.enabled || !eligibility.can_review) {
        const reasonKey = eligibility.reason ?? "NOT_PURCHASED";
        const message = reasonMessages[reasonKey] ?? "You are not eligible to review this product.";

        if (reasonKey === "ALREADY_REVIEWED") {
          setReviewedItems((prev) => ({ ...prev, [item.id]: true }));
        }

        setEligibilityError(message);
        return;
      }

      setModal({
        orderId,
        item,
        slug: item.product_slug,
      });
    } finally {
      setEligibilityLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await submitProductReview(modal.slug, {
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

  return (
    <div className="space-y-4">
      {eligibilityError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {eligibilityError}
        </div>
      )}
      {submitSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {submitSuccess}
        </div>
      )}

      {orders.map((order) => {
        const statusKey = (order.status || "").toLowerCase();
        const badgeStyle =
          statusKey === "pending"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : statusKey === "paid" || statusKey === "completed"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : statusKey === "shipped"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : statusKey === "cancelled"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-[var(--muted)]/60 text-[var(--foreground)] border-transparent";

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
              </div>

              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="sm:col-span-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/60">Items</p>
                  <div className="space-y-2">
                    {order.items.map((item) => {
                      const isReviewed = reviewedItemIds[item.id] === true;
                      const disabled = isReviewed || !item.product_slug;
                      const canReview = statusKey === "completed";
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--muted)] bg-[var(--background)] px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            {item.product_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.product_image}
                                alt={item.name ?? "Product image"}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-[var(--muted)]" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                              <p className="text-xs text-[var(--foreground)]/70">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          {canReview && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenReview(order.id, item)}
                                disabled={disabled || eligibilityLoading}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isReviewed ? "Reviewed" : "Write Review"}
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Write a Review</h3>
                <p className="text-sm text-gray-600">{modal.item.name}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Rating</label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
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
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Summarize your review"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Your Review</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="h-28 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Share your experience with this product"
                  maxLength={2000}
                  required
                  disabled={submitting}
                />
              </div>

              {submitError && <p className="text-sm text-rose-600">{submitError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
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
    </div>
  );
}
