<?php

namespace App\Services\Loyalty;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\LoyaltyRedemption;
use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use App\Services\Ecommerce\MembershipTierService;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PointsService
{
    public function __construct(protected MembershipTierService $membershipTierService)
    {
    }

    public function getSummaryForCustomer(Customer $customer): array
    {
        $now = Carbon::now();

        $available = $this->getAvailablePoints($customer, $now);
        $totalEarned = (int) PointsEarnBatch::where('customer_id', $customer->id)->sum('points_total');
        $totalRedeemed = (int) abs(PointsTransaction::where('customer_id', $customer->id)
            ->where('type', 'redeem')
            ->sum('points_change'));
        $totalExpired = (int) abs(PointsTransaction::where('customer_id', $customer->id)
            ->where('type', 'expire')
            ->sum('points_change'));

        $expiringSoon = PointsEarnBatch::where('customer_id', $customer->id)
            ->where('status', 'active')
            ->where('points_remaining', '>', 0)
            ->whereBetween('expires_at', [$now, $now->copy()->addDays(60)])
            ->orderBy('expires_at')
            ->get()
            ->groupBy(fn($batch) => $batch->expires_at->toDateString())
            ->map(function ($batches, $date) {
                return [
                    'expires_at' => $date,
                    'points' => (int) $batches->sum('points_remaining'),
                ];
            })
            ->values()
            ->all();

        $loyaltyProgress = $this->membershipTierService->buildLoyaltyProgress($customer);

        return [
            'customer_id' => $customer->id,
            'current_tier' => $loyaltyProgress['current_tier'],
            'points' => [
                'total_earned' => $totalEarned,
                'total_redeemed' => $totalRedeemed,
                'total_expired' => $totalExpired,
                'available' => $available,
                'expiring_soon' => $expiringSoon,
            ],
            'spending' => $loyaltyProgress['spending'],
        ];
    }

    public function getHistoryForCustomer(Customer $customer, array $filters = []): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;

        return PointsTransaction::where('customer_id', $customer->id)
            ->when(!empty($filters['type']), fn($q) => $q->where('type', $filters['type']))
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function redeemPointsForReward(Customer $customer, LoyaltyReward $reward): LoyaltyRedemption
    {
        if (!$reward->is_active) {
            throw ValidationException::withMessages([
                'reward_id' => __('Selected reward is not active.'),
            ]);
        }

        $availablePoints = $this->getAvailablePoints($customer, Carbon::now());
        $required = (int) $reward->points_required;

        if ($availablePoints < $required) {
            throw ValidationException::withMessages([
                'points' => __('Insufficient points for this reward.'),
            ])->status(422);
        }

        return DB::transaction(function () use ($customer, $reward, $required) {
            $now = Carbon::now();
            $remaining = $required;

            $batches = PointsEarnBatch::where('customer_id', $customer->id)
                ->where('status', 'active')
                ->where('points_remaining', '>', 0)
                ->where('expires_at', '>', $now)
                ->orderBy('earned_at')
                ->lockForUpdate()
                ->get();

            foreach ($batches as $batch) {
                if ($remaining <= 0) {
                    break;
                }

                $deduct = min($batch->points_remaining, $remaining);
                $batch->points_remaining -= $deduct;
                $batch->save();
                $remaining -= $deduct;
            }

            if ($remaining > 0) {
                throw ValidationException::withMessages([
                    'points' => __('Insufficient points for this reward.'),
                ])->status(422);
            }

            $redemption = LoyaltyRedemption::create([
                'customer_id' => $customer->id,
                'reward_id' => $reward->id,
                'points_spent' => $required,
                'status' => 'pending',
                'reward_title_snapshot' => $reward->title,
                'points_required_snapshot' => $reward->points_required,
                'meta' => $this->buildRedemptionMeta($reward),
            ]);

            PointsTransaction::create([
                'customer_id' => $customer->id,
                'type' => 'redeem',
                'points_change' => -1 * $required,
                'source_type' => 'loyalty_reward',
                'source_id' => $reward->id,
                'meta' => [
                    'reward_title' => $reward->title,
                    'redemption_id' => $redemption->id,
                ],
            ]);

            return $redemption;
        });
    }

    protected function getAvailablePoints(Customer $customer, Carbon $now): int
    {
        return (int) PointsEarnBatch::where('customer_id', $customer->id)
            ->where('status', 'active')
            ->where('points_remaining', '>', 0)
            ->where('expires_at', '>', $now)
            ->sum('points_remaining');
    }

    protected function buildRedemptionMeta(LoyaltyReward $reward): array
    {
        $meta = [];

        if ($reward->type === 'voucher' && $reward->voucher_id) {
            $meta['voucher_id'] = $reward->voucher_id;
        }

        if ($reward->type === 'product' && $reward->product_id) {
            $meta['product_id'] = $reward->product_id;
        }

        return $meta;
    }
}
