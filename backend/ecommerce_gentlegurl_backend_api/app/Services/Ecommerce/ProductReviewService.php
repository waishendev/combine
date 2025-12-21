<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductReview;
use App\Services\SettingService;
use Carbon\Carbon;

class ProductReviewService
{
    public function settings(): array
    {
        return SettingService::get('product_reviews', [
            'enabled' => true,
            'review_window_days' => 30,
        ]);
    }

    public function isEnabled(): bool
    {
        $settings = $this->settings();

        return (bool) ($settings['enabled'] ?? false);
    }

    public function buildSummary(int $productId): array
    {
        $average = ProductReview::where('product_id', $productId)->avg('rating');
        $count = ProductReview::where('product_id', $productId)->count();

        $countsByRating = ProductReview::where('product_id', $productId)
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating');

        $distribution = [];
        for ($rating = 5; $rating >= 1; $rating--) {
            $distribution[(string) $rating] = (int) ($countsByRating[$rating] ?? 0);
        }

        return [
            'avg_rating' => $count > 0 ? round((float) $average, 1) : 0,
            'count' => $count,
            'distribution' => $distribution,
        ];
    }

    public function recentReviews(int $productId, int $limit = 3): array
    {
        return ProductReview::with('customer')
            ->where('product_id', $productId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn(ProductReview $review) => $this->transformReview($review))
            ->all();
    }

    public function transformReview(ProductReview $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'customer_name' => $review->customer?->name ?? 'Anonymous',
            'created_at' => $review->created_at?->toIso8601String(),
        ];
    }

    public function determineEligibility(Product $product, ?Customer $customer): array
    {
        $settings = $this->settings();
        $enabled = (bool) ($settings['enabled'] ?? false);
        $reviewWindowDays = (int) ($settings['review_window_days'] ?? 30);

        $existingReview = null;
        $canReview = false;
        $reason = null;
        $completedAt = null;
        $deadlineAt = null;
        $eligibleOrderItem = null;

        if (! $enabled) {
            $reason = 'REVIEWS_DISABLED';

            return [
                'enabled' => $enabled,
                'can_review' => $canReview,
                'reason' => $reason,
                'my_review' => $existingReview,
                'review_window_days' => $reviewWindowDays,
                'completed_at' => $completedAt,
                'deadline_at' => $deadlineAt,
                'eligible_order_item' => $eligibleOrderItem,
            ];
        }

        if (! $customer) {
            $reason = 'NOT_AUTHENTICATED';

            return [
                'enabled' => $enabled,
                'can_review' => $canReview,
                'reason' => $reason,
                'my_review' => $existingReview,
                'review_window_days' => $reviewWindowDays,
                'completed_at' => $completedAt,
                'deadline_at' => $deadlineAt,
                'eligible_order_item' => $eligibleOrderItem,
            ];
        }

        $existingReview = ProductReview::where('product_id', $product->id)
            ->where('customer_id', $customer->id)
            ->first();

        $latestCustomerOrderItem = OrderItem::with('order')
            ->where('product_id', $product->id)
            ->whereHas('order', function ($query) use ($customer) {
                $query->where('customer_id', $customer->id);
            })
            ->orderByDesc('id')
            ->first();

        $completedOrderItem = OrderItem::with('order')
            ->where('product_id', $product->id)
            ->whereHas('order', function ($query) use ($customer) {
                $query->where('customer_id', $customer->id)
                    ->where('status', 'completed');
            })
            ->orderByDesc('order_id')
            ->orderByDesc('id')
            ->first();

        if (! $latestCustomerOrderItem) {
            $reason = 'NOT_PURCHASED';
        } elseif (! $completedOrderItem) {
            $reason = 'ORDER_NOT_COMPLETED';
        } else {
            $eligibleOrderItem = $completedOrderItem;
            $completedAt = $this->resolveCompletionDate($completedOrderItem->order);
            $deadlineAt = $completedAt?->copy()->addDays($reviewWindowDays);

            if ($existingReview) {
                $reason = 'ALREADY_REVIEWED';
            } elseif ($deadlineAt && Carbon::now()->greaterThan($deadlineAt)) {
                $reason = 'REVIEW_WINDOW_EXPIRED';
            } else {
                $canReview = true;
                $reason = null;
            }
        }

        return [
            'enabled' => $enabled,
            'can_review' => $canReview,
            'reason' => $reason,
            'my_review' => $existingReview,
            'review_window_days' => $reviewWindowDays,
            'completed_at' => $completedAt,
            'deadline_at' => $deadlineAt,
            'eligible_order_item' => $eligibleOrderItem,
        ];
    }

    protected function resolveCompletionDate(?Order $order): ?Carbon
    {
        if (! $order) {
            return null;
        }

        return $order->completed_at
            ?? $order->paid_at
            ?? $order->placed_at
            ?? $order->updated_at
            ?? $order->created_at;
    }
}
