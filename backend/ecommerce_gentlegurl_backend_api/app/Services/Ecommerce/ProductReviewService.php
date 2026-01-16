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
        return ProductReview::with(['customer', 'orderItem.productVariant'])
            ->where('product_id', $productId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn(ProductReview $review) => $this->transformReview($review))
            ->all();
    }

    public function transformReview(ProductReview $review): array
    {
        $orderItem = $review->orderItem;
        $variant = $orderItem?->productVariant;
        $variantName = $orderItem?->variant_name_snapshot ?? $variant?->title;
        $variantSku = $orderItem?->variant_sku_snapshot ?? $variant?->sku;
        $variantId = $review->variant_id ?? $orderItem?->product_variant_id ?? $variant?->id;

        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'customer_name' => $review->customer?->name ?? 'Anonymous',
            'created_at' => $review->created_at?->toIso8601String(),
            'variant' => $variantId ? [
                'id' => $variantId,
                'name' => $variantName,
                'sku' => $variantSku,
            ] : null,
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
            ->orderByDesc('created_at')
            ->first();

        $latestCustomerOrderItem = OrderItem::where('product_id', $product->id)
            ->whereHas('order', function ($query) use ($customer) {
                $query->where('customer_id', $customer->id);
            })
            ->latest('id')
            ->first();

        $completedOrderItems = OrderItem::with(['order', 'review'])
            ->where('product_id', $product->id)
            ->whereHas('order', function ($query) use ($customer) {
                $query->where('customer_id', $customer->id)
                    ->where('status', 'completed');
            })
            ->orderByDesc('order_id')
            ->orderByDesc('id')
            ->get();

        if (! $latestCustomerOrderItem) {
            $reason = 'NOT_PURCHASED';
        } elseif ($completedOrderItems->isEmpty()) {
            $reason = 'ORDER_NOT_COMPLETED';
        } else {
            $hasReviewed = false;
            $hasExpired = false;

            foreach ($completedOrderItems as $orderItem) {
                if ($orderItem->review) {
                    $hasReviewed = true;
                    continue;
                }

                $completedAt = $this->resolveCompletionDate($orderItem->order);
                $deadlineAt = $completedAt?->copy()->addDays($reviewWindowDays);

                if ($deadlineAt && Carbon::now()->greaterThan($deadlineAt)) {
                    $hasExpired = true;
                    continue;
                }

                $eligibleOrderItem = $orderItem;
                $canReview = true;
                $reason = null;
                break;
            }

            if (! $eligibleOrderItem) {
                $reason = $hasExpired ? 'REVIEW_WINDOW_EXPIRED' : 'ALREADY_REVIEWED';
                $completedAt = $this->resolveCompletionDate($completedOrderItems->first()?->order);
                $deadlineAt = $completedAt?->copy()->addDays($reviewWindowDays);
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

    public function resolveCompletionDate(?Order $order): ?Carbon
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
