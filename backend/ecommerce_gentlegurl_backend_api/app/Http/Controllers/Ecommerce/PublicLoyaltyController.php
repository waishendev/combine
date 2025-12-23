<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyReward;
use App\Services\Ecommerce\LoyaltySummaryService;
use App\Services\Loyalty\PointsService;
use Illuminate\Http\Request;

class PublicLoyaltyController extends Controller
{
    use ResolvesCurrentCustomer;

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

            $thumbnail = $productImage?->image_path ;

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
                'product' => $product ? [
                    'id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'sku' => $product->sku,
                    'thumbnail' => $thumbnail,
                ] : null,
                'voucher_code' => $reward->voucher?->code,
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
}
