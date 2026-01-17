<?php

namespace App\Services\Loyalty;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\LoyaltyRedemption;
use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\CartItem;
use App\Models\Ecommerce\Product;
use App\Services\Ecommerce\MembershipTierService;
use App\Services\Ecommerce\CartService;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PointsService
{
    public function __construct(
        protected MembershipTierService $membershipTierService,
        protected CartService $cartService,
    )
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

        if ($reward->type === 'voucher' && !$reward->voucher_id) {
            throw ValidationException::withMessages([
                'reward_id' => __('Selected voucher reward is not configured correctly.'),
            ]);
        }

        if ($reward->type === 'product') {
            $product = $reward->product;
            if (!$product) {
                throw ValidationException::withMessages([
                    'reward_id' => __('Selected product reward is missing product.'),
                ]);
            }

            if (!$product->is_reward_only) {
                throw ValidationException::withMessages([
                    'reward_id' => __('Reward product must be reward-only.'),
                ]);
            }
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

            $reward = LoyaltyReward::whereKey($reward->id)->lockForUpdate()->firstOrFail();

            if (!$reward->is_active) {
                throw ValidationException::withMessages([
                    'reward_id' => __('Selected reward is not active.'),
                ]);
            }

            if ($reward->type === 'voucher') {
                if ($reward->quota_total !== null && $reward->quota_used >= $reward->quota_total) {
                    throw ValidationException::withMessages([
                        'reward_id' => __('This reward has been fully redeemed.'),
                    ])->status(422);
                }
            }

            $lockedProduct = null;
            if ($reward->type === 'product' && $reward->product_id) {
                $lockedProduct = Product::whereKey($reward->product_id)->lockForUpdate()->first();

                if (!$lockedProduct) {
                    throw ValidationException::withMessages([
                        'reward_id' => __('Selected product reward is missing product.'),
                    ]);
                }

                if ($lockedProduct->stock <= 0) {
                    throw ValidationException::withMessages([
                        'reward_id' => __('Out of stock.'),
                    ])->status(422);
                }
            }

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

            if ($reward->type === 'voucher') {
                $reward->quota_used = (int) $reward->quota_used + 1;
                $reward->save();
            }

            if ($lockedProduct) {
                $lockedProduct->stock = (int) $lockedProduct->stock - 1;
                $lockedProduct->save();
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

            if ($reward->type === 'voucher' && $reward->voucher_id) {
                $voucher = $reward->voucher;
                CustomerVoucher::create([
                    'customer_id' => $customer->id,
                    'voucher_id' => $reward->voucher_id,
                    'quantity_total' => 1,
                    'quantity_used' => 0,
                    'source_redemption_id' => $redemption->id,
                    'status' => 'active',
                    'claimed_at' => $now,
                    'start_at' => $voucher?->start_at,
                    'end_at' => $voucher?->end_at,
                    'expires_at' => $voucher?->end_at,
                ]);

                $redemption->status = 'completed';
                $redemption->save();
            }

            if ($reward->type === 'product' && $reward->product_id) {
                $this->addRewardProductToCart($customer, $reward->product_id, $redemption);
            }

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

    protected function addRewardProductToCart(Customer $customer, int $productId, LoyaltyRedemption $redemption): void
    {
        $cart = $this->cartService->findOrCreateCart($customer, null)['cart'];

        $existing = CartItem::where('cart_id', $cart->id)
            ->where('reward_redemption_id', $redemption->id)
            ->first();

        $product = Product::find($productId);

        if (!$product) {
            return;
        }

        if ($existing) {
            $existing->update([
                'quantity' => 1,
                'unit_price_snapshot' => 0,
                'is_reward' => true,
                'locked' => true,
            ]);
        } else {
            CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'quantity' => 1,
                'unit_price_snapshot' => 0,
                'is_reward' => true,
                'reward_redemption_id' => $redemption->id,
                'locked' => true,
            ]);
        }
    }
}
