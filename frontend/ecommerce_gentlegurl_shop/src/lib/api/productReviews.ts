import { get, post } from "../apiClient";
import { ProductReviewsData, ReviewEligibility, ReviewItem, ReviewSummary } from "../types/reviews";

type ReviewListResponse = { data: ProductReviewsData };
type ReviewEligibilityResponse = { data: ReviewEligibility };
type SubmitReviewResponse = { data: { my_review: ReviewItem; summary: ReviewSummary } };

export async function fetchProductReviews(slug: string): Promise<ProductReviewsData | null> {
  try {
    const response = await get<ReviewListResponse>(`/public/shop/products/${slug}/reviews`);
    return response.data;
  } catch (error) {
    console.error("[fetchProductReviews] Failed", error);
    return null;
  }
}

export async function fetchProductReviewEligibility(slug: string): Promise<ReviewEligibility | null> {
  try {
    const response = await get<ReviewEligibilityResponse>(`/public/shop/products/${slug}/review-eligibility`);
    return response.data;
  } catch (error) {
    console.error("[fetchProductReviewEligibility] Failed", error);
    return null;
  }
}

export async function submitProductReview(
  slug: string,
  payload: { rating: number; title?: string | null; body: string },
): Promise<{ my_review: ReviewItem; summary: ReviewSummary }> {
  const response = await post<SubmitReviewResponse>(`/public/shop/products/${slug}/reviews`, payload);
  return response.data;
}
