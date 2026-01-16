<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\ProductReview;
use App\Services\Ecommerce\ProductReviewService;
use Illuminate\Http\Request;

class PublicProductReviewController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(protected ProductReviewService $reviewService)
    {
    }

    public function index(string $slug)
    {
        $product = Product::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $reviews = ProductReview::with(['customer', 'orderItem.productVariant'])
            ->where('product_id', $product->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn(ProductReview $review) => $this->reviewService->transformReview($review))
            ->all();

        return $this->respond([
            'summary' => $this->reviewService->buildSummary($product->id),
            'items' => $reviews,
        ]);
    }

    public function eligibility(string $slug)
    {
        $product = Product::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $customer = $this->currentCustomer();
        $eligibility = $this->reviewService->determineEligibility($product, $customer);

        return $this->respond([
            'enabled' => $eligibility['enabled'],
            'can_review' => $eligibility['can_review'],
            'reason' => $eligibility['reason'],
            'my_review' => $eligibility['my_review']
                ? $this->reviewService->transformReview($eligibility['my_review'])
                : null,
            'review_window_days' => $eligibility['review_window_days'],
            'completed_at' => $eligibility['completed_at']?->toIso8601String(),
            'deadline_at' => $eligibility['deadline_at']?->toIso8601String(),
            'eligible_order_item_id' => $eligibility['eligible_order_item']?->id,
        ]);
    }

    public function store(Request $request, string $slug)
    {
        $customer = $this->requireCustomer();

        $validated = $request->validate([
            'order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $product = Product::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $settings = $this->reviewService->settings();

        if (! ($settings['enabled'] ?? false)) {
            return $this->respondError(__('Product reviews are disabled.'), 422, [
                'reason' => 'REVIEWS_DISABLED',
            ]);
        }

        $orderItem = OrderItem::with(['order', 'review'])
            ->where('id', $validated['order_item_id'])
            ->firstOrFail();

        if (! $orderItem->order || $orderItem->order->customer_id !== $customer->id) {
            return $this->respondError(__('You are not eligible to review this product.'), 422, [
                'reason' => 'NOT_PURCHASED',
            ]);
        }

        if ((int) $orderItem->product_id !== (int) $product->id) {
            return $this->respondError(__('Review item does not match this product.'), 422, [
                'reason' => 'NOT_PURCHASED',
            ]);
        }

        if ($orderItem->order->status !== 'completed') {
            return $this->respondError(__('You can review after the order is completed.'), 422, [
                'reason' => 'ORDER_NOT_COMPLETED',
            ]);
        }

        if ($orderItem->review || ProductReview::where('order_item_id', $orderItem->id)->exists()) {
            return $this->respondError(__('You already reviewed this purchase.'), 422, [
                'reason' => 'ALREADY_REVIEWED',
            ]);
        }

        $reviewWindowDays = (int) ($settings['review_window_days'] ?? 30);
        $completedAt = $this->reviewService->resolveCompletionDate($orderItem->order);
        $deadlineAt = $completedAt?->copy()->addDays($reviewWindowDays);

        if ($deadlineAt && now()->greaterThan($deadlineAt)) {
            return $this->respondError(__('Review window has expired.'), 422, [
                'reason' => 'REVIEW_WINDOW_EXPIRED',
            ]);
        }

        $review = ProductReview::create([
            'product_id' => $product->id,
            'customer_id' => $customer->id,
            'order_id' => $orderItem->order_id,
            'order_item_id' => $orderItem->id,
            'variant_id' => $orderItem->product_variant_id,
            'rating' => $validated['rating'],
            'title' => $validated['title'] ?? null,
            'body' => $validated['body'],
        ])->load(['customer', 'orderItem.productVariant']);

        return $this->respond([
            'my_review' => $this->reviewService->transformReview($review),
            'summary' => $this->reviewService->buildSummary($product->id),
        ], __('Review submitted successfully.'));
    }
}
