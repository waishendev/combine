"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { fetchProductReviewEligibility, fetchProductReviews, submitProductReview } from "@/lib/api/productReviews";
import { ProductReviewsData, ReviewEligibility, ReviewSettings } from "@/lib/types/reviews";
import { RatingStars } from "../reviews/RatingStars";

type ProductReviewsSectionProps = {
  slug: string;
  initialReviews: ProductReviewsData | null;
  initialEligibility: ReviewEligibility | null;
  settings?: ReviewSettings | null;
};

const reasonMessages: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to write a review.",
  NOT_PURCHASED: "Only customers who purchased this product can review.",
  ORDER_NOT_COMPLETED: "You can review after the order is completed.",
  REVIEW_WINDOW_EXPIRED: "Review period expired.",
  ALREADY_REVIEWED: "You have already reviewed this product.",
  REVIEWS_DISABLED: "Reviews are disabled.",
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

export function ProductReviewsSection({
  slug,
  initialReviews,
  initialEligibility,
  settings,
}: ProductReviewsSectionProps) {
  const [reviewsData, setReviewsData] = useState<ProductReviewsData | null>(initialReviews);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(initialEligibility);
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const reviewsEnabled = (settings?.enabled ?? eligibility?.enabled ?? true) === true;

  const refreshEligibility = useCallback(async () => {
    const freshEligibility = await fetchProductReviewEligibility(slug);
    if (freshEligibility) {
      setEligibility(freshEligibility);
    }
  }, [slug]);

  const refreshReviews = useCallback(async () => {
    const latestReviews = await fetchProductReviews(slug);
    if (latestReviews) {
      setReviewsData(latestReviews);
    }
  }, [slug]);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSuccess(null);
      setSubmitting(true);

      try {
        if (!eligibility?.eligible_order_item_id) {
          setError("Please review this product from a completed order.");
          return;
        }

        const payload = {
          order_item_id: eligibility.eligible_order_item_id,
          rating,
          title: title?.trim() || null,
          body: body.trim(),
        };

        const response = await submitProductReview(slug, payload);
        setSuccess("Review submitted successfully.");
        setBody("");
        setTitle("");
        setRating(5);

        setReviewsData((prev) => {
          const existing = prev?.items ?? [];
          const filtered = existing.filter((item) => item.id !== response.my_review.id);
          return {
            summary: response.summary,
            items: [response.my_review, ...filtered],
          };
        });

        await refreshEligibility();
        await refreshReviews();
      } catch (submitError) {
        console.error("[ProductReviews] Submit failed", submitError);
        const message =
          typeof submitError === "object" && submitError && "data" in submitError
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (submitError as any).data?.message ?? "Unable to submit review."
            : "Unable to submit review.";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [body, eligibility, rating, refreshEligibility, refreshReviews, slug, title],
  );

  const eligibilityMessage = useMemo(() => {
    if (!reviewsEnabled) return reasonMessages.REVIEWS_DISABLED;
    if (eligibility?.can_review) return null;
    const reasonKey = eligibility?.reason ?? (eligibility ? "NOT_PURCHASED" : "NOT_AUTHENTICATED");
    return reasonMessages[reasonKey] ?? "You are not eligible to review this product.";
  }, [eligibility, reviewsEnabled]);

  const summary = reviewsData?.summary;
  const items = reviewsData?.items ?? [];

  return (
    <section id="reviews" className="mt-12 rounded-2xl border border-[var(--muted)] bg-[var(--review-background)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Reviews</h2>
          {/* {reviewsEnabled ? (
            <p className="text-sm text-[var(--foreground)]/70">
              {summary?.count ? `${summary.avg_rating} average based on ${summary.count} review(s)` : "No reviews yet."}
            </p>
          ) : (
            <p className="text-sm text-[var(--foreground)]/70">Reviews are disabled.</p>
          )} */}
        </div>
        {reviewsEnabled && summary ? (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--muted)] px-3 py-2">
            <div className="text-2xl font-semibold text-[var(--foreground)]">{summary.avg_rating.toFixed(1)}</div>
            <RatingStars value={summary.avg_rating} />
          </div>
        ) : null}
      </div>

      {reviewsEnabled && summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--muted)]/40 p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Ratings Breakdown</p>
            <div className="mt-3 space-y-2">
              {[5, 4, 3, 2, 1].map((ratingValue) => {
                const count = summary.distribution?.[ratingValue.toString()] ?? 0;
                const percent = summary.count ? Math.round((count / summary.count) * 100) : 0;
                return (
                  <div key={ratingValue} className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                    <div className="w-5 font-semibold">{ratingValue}</div>
                    <div className="h-2 flex-1 rounded-full bg-[var(--muted)]/70">
                      <div className="h-2 rounded-full bg-[var(--status-warning)]" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="w-12 text-right text-xs text-[var(--foreground)]/70">{count} review(s)</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--muted)]/40 p-4 max-h-[300px] overflow-y-auto">    
          {reviewsEnabled && items.length > 0 && (
            <div className="space-y-3">
              {items.map((review) => (
                <div key={review.id} className="rounded-xl border border-[var(--muted)] bg-[var(--review-background)] p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]/70 mb-2">{review.customer_name}</p>
                      <RatingStars value={review.rating} size="sm" />
                      <p className="text-xs text-[var(--foreground)]/60 mt-2">
                      {formatDate(review.created_at)}
                      {review.variant && (review.variant.name || review.variant.sku) && (
                        <span> | Variation: {review.variant.name ?? "—"}</span>
                      )}
                    </p>
                      {/* {review.title && <p className="text-sm font-semibold text-[var(--foreground)]">{review.title}</p>} */}
                    </div>

                  </div>
                  <p className="mt-2 text-sm text-[var(--foreground)]/80">{review.body}</p>

                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}



      {/* <div className="rounded-xl bg-[var(--muted)]/40 p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">Write a Review</p>
      {eligibility?.my_review && (
      <p className="mt-1 text-xs text-[var(--foreground)]/70">
      You submitted a review on {formatDate(eligibility.my_review.created_at)}.
      </p>
      )}
      {eligibilityMessage && (
      <p className="mt-2 text-sm text-[var(--foreground)]/70">
      {eligibilityMessage}{" "}
      {eligibility?.reason === "NOT_AUTHENTICATED" && (
      <Link href="/login" className="text-[var(--accent)] underline">
      Sign in
      </Link>
      )}
      </p>
      )}

      {reviewsEnabled && eligibility?.can_review && (
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
      Rating
      </label>
      <div className="mt-1 flex items-center gap-4">
      <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
      <button
      key={index}
      type="button"
      onClick={() => setRating(index + 1)}
      disabled={submitting}
      className={`text-3xl transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-70 ${
      index < rating ? "text-[color:var(--status-warning)]" : "text-[var(--muted)]"
      }`}
      >
      ★
      </button>
      ))}
      </div>
      <span className="text-sm font-semibold text-[color:var(--text-muted)]">{rating} out of 5</span>
      </div>
      </div>

      <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
      Title (optional)
      </label>
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
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
      Review
      </label>
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

      {error && <p className="text-sm text-[color:var(--status-error)]">{error}</p>}
      {success && <p className="text-sm text-[color:var(--status-success)]">{success}</p>}

      <button
      type="submit"
      className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      disabled={submitting}
      >
      {submitting ? "Submitting..." : "Submit Review"}
      </button>
      </form>
      )}
      </div> */}





    </section>
  );
}
