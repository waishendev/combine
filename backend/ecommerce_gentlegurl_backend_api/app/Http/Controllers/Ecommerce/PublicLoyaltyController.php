<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\MembershipTierRule;
use App\Services\Ecommerce\MembershipTierService;
use App\Services\Ecommerce\LoyaltySummaryService;
use App\Services\Loyalty\PointsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PublicLoyaltyController extends Controller
{
    use ResolvesCurrentCustomer;

    protected const PRODUCT_PLACEHOLDER = '/images/placeholder.png';

    public function summary(Request $request, LoyaltySummaryService $loyaltySummary)
    {
        $customer = $this->requireCustomer();

        return $this->respond($loyaltySummary->getSummaryFor($customer));
    }

    public function history(Request $request, PointsService $pointsService)
    {
        $customer = $this->requireCustomer();

        $filters = [
            'type' => $request->string('type')->toString() ?: null,
            'per_page' => $request->integer('per_page', 15),
        ];

        return $this->respond(
            $pointsService->getHistoryForCustomer($customer, array_filter($filters))
        );
    }

    public function rewards(Request $request)
    {
        $rewards = LoyaltyReward::query()
            ->where('is_active', true)
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->string('type')->toString()))
            ->with(['product.images', 'voucher'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $payload = $rewards->map(function (LoyaltyReward $reward) {
            $product = $reward->product;
            $productImage = $product?->images
                ? $product->images->sortBy('sort_order')->sortBy('id')->first()
                : null;

            $thumbnail = $productImage?->image_path;
            $imageUrl = $thumbnail ? Storage::disk('public')->url($thumbnail) : self::PRODUCT_PLACEHOLDER;
            $remaining = null;

            if ($reward->type === 'voucher') {
                $remaining = $reward->quota_total === null
                    ? null
                    : max(0, (int) $reward->quota_total - (int) $reward->quota_used);
            } elseif ($reward->type === 'product') {
                $remaining = $product?->stock ?? 0;
            }

            $isAvailable = $remaining === null ? true : $remaining > 0;

            return [
                'id' => $reward->id,
                'title' => $reward->title,
                'description' => $reward->description,
                'type' => $reward->type,
                'points_required' => $reward->points_required,
                'product_id' => $reward->product_id,
                'voucher_id' => $reward->voucher_id,
                'is_active' => $reward->is_active,
                'sort_order' => $reward->sort_order,
                'thumbnail' => $thumbnail,
                'remaining' => $remaining,
                'is_available' => $isAvailable,
                'product' => $product ? [
                    'id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'image_url' => $imageUrl,
                    'stock' => $product->stock,
                ] : null,
                'voucher_code' => $reward->voucher?->code,
                'voucher' => $reward->voucher ? [
                    'code' => $reward->voucher->code,
                    'type' => $reward->voucher->type,
                    'value' => (float) $reward->voucher->value,
                    'amount' => (float) $reward->voucher->amount,
                    'min_order_amount' => $reward->voucher->min_order_amount,
                    'max_discount_amount' => $reward->voucher->max_discount_amount,
                    'start_at' => $reward->voucher->start_at,
                    'end_at' => $reward->voucher->end_at,
                    'usage_limit_total' => $reward->voucher->usage_limit_total,
                    'usage_limit_per_customer' => $reward->voucher->usage_limit_per_customer,
                    'max_uses' => $reward->voucher->max_uses,
                    'max_uses_per_customer' => $reward->voucher->max_uses_per_customer,
                    'is_reward_only' => $reward->voucher->is_reward_only,
                ] : null,
            ];
        })->values();

        return $this->respond($payload);
    }

    public function redeem(Request $request, PointsService $pointsService)
    {
        $customer = $this->requireCustomer();

        $validated = $request->validate([
            'reward_id' => ['required', 'integer', 'exists:loyalty_rewards,id'],
        ]);

        $reward = LoyaltyReward::findOrFail($validated['reward_id']);

        $redemption = $pointsService->redeemPointsForReward($customer, $reward);
        $summary = $pointsService->getSummaryForCustomer($customer);

        return $this->respond([
            'redemption_id' => $redemption->id,
            'status' => $redemption->status,
            'points_spent' => $redemption->points_spent,
            'reward' => [
                'id' => $reward->id,
                'title' => $reward->title,
                'type' => $reward->type,
            ],
            'current_points_balance' => $summary['points']['available'],
        ], __('Redemption created successfully.'));
    }

    public function membershipTiers(MembershipTierService $membershipTierService)
    {
        $tiers = MembershipTierRule::query()
            ->where('is_active', true)
            ->orderBy('min_spent_last_x_months')
            ->orderBy('sort_order')
            ->get()
            ->map(fn(MembershipTierRule $rule) => $membershipTierService->formatTierData($rule))
            ->filter()
            ->values();

        return $this->respond($tiers);
    }
}
