export type ReviewSummary = {
  avg_rating: number;
  count: number;
  distribution: Record<string, number>;
};

export type ReviewItem = {
  id: number;
  rating: number;
  title?: string | null;
  body: string;
  customer_name: string;
  created_at?: string | null;
  variant?: {
    id: number;
    name?: string | null;
    sku?: string | null;
  } | null;
};

export type ReviewSettings = {
  enabled: boolean;
  review_window_days: number;
};

export type ReviewEligibility = {
  enabled: boolean;
  can_review: boolean;
  reason?: string | null;
  my_review?: ReviewItem | null;
  review_window_days: number;
  completed_at?: string | null;
  deadline_at?: string | null;
  eligible_order_item_id?: number | null;
};

export type ProductReviewsData = {
  summary: ReviewSummary;
  items: ReviewItem[];
};
