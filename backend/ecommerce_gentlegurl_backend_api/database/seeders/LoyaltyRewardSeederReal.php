<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Ecommerce\Voucher;

use App\Models\Ecommerce\LoyaltyReward;

class LoyaltyRewardSeederReal extends Seeder
{
    public function run(): void
    {
        $voucherRm5 = Voucher::firstOrCreate(
            ['code' => 'RM5-REWARD'],
            [
                'type' => 'fixed',
                'value' => 5,
                'min_order_amount' => 0,
                'is_active' => true,
                'usage_limit_total' => null,
                'usage_limit_per_customer' => null,
                'is_reward_only' => true,
            ]
        );

        $voucherRm10 = Voucher::firstOrCreate(
            ['code' => 'RM10-REWARD'],
            [
                'type' => 'fixed',
                'value' => 10,
                'min_order_amount' => 0,
                'is_active' => true,
                'usage_limit_total' => null,
                'usage_limit_per_customer' => null,
                'is_reward_only' => true,
            ]
        );

        $rewards = [
            [
                'title' => 'RM5 Discount Voucher',
                'description' => 'Redeem RM5 off your next purchase.',
                'type' => 'voucher',
                'points_required' => 500,
                'voucher_id' => $voucherRm5->id,
                'quota_total' => null,
                'product_id' => null,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'title' => 'RM10 Discount Voucher',
                'description' => 'Redeem RM10 off your next purchase.',
                'type' => 'voucher',
                'points_required' => 888,
                'voucher_id' => $voucherRm10->id,
                'quota_total' => null,
                'product_id' => null,
                'is_active' => true,
                'sort_order' => 2,
            ],
        ];

        foreach ($rewards as $index => $reward) {
            LoyaltyReward::updateOrCreate(
                ['title' => $reward['title']],
                array_merge($reward, ['sort_order' => $reward['sort_order'] ?? ($index + 1)])
            );
        }
    }
}
