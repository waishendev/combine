<?php

namespace Database\Seeders;

use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductImage;
use App\Models\Ecommerce\Voucher;
use Illuminate\Database\Seeder;

class LoyaltyRewardSeederTesting extends Seeder
{
    public function run(): void
    {
        $voucher = Voucher::firstOrCreate(
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

        $rewardProduct = Product::firstOrCreate(
            ['slug' => 'reward-free-tshirt'],
            [
                'name' => 'Reward - Free T-Shirt',
                'sku' => 'REWARD-TEE',
                'type' => 'single',
                'price' => 0,
                'cost_price' => 0,
                'stock' => 3,
                'low_stock_threshold' => 0,
                'is_active' => true,
                'is_featured' => false,
                'is_reward_only' => true,
            ]
        );

        $placeholderImagePath = '/images/placeholder.png';
        ProductImage::updateOrCreate(
            [
                'product_id' => $rewardProduct->id,
                'image_path' => $placeholderImagePath,
            ],
            [
                'is_main' => true,
                'sort_order' => 0,
            ]
        );

        $rewards = [
            [
                'title' => 'RM10 Discount Voucher',
                'description' => 'Redeem RM10 off your next purchase.',
                'type' => 'voucher',
                'points_required' => 500,
                'voucher_id' => $voucher->id,
                'quota_total' => 5,
                'product_id' => null,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'title' => 'Free T-Shirt',
                'description' => 'Claim a free t-shirt with your points.',
                'type' => 'product',
                'points_required' => 800,
                'product_id' => $rewardProduct->id,
                'voucher_id' => null,
                'is_active' => true,
                'sort_order' => 2,
            ],
            // [
            //     'title' => 'Free Gift (In-store)',
            //     'description' => 'Collect a complimentary in-store gift.',
            //     'type' => 'custom',
            //     'points_required' => 300,
            //     'product_id' => null,
            //     'voucher_id' => null,
            //     'is_active' => true,
            //     'sort_order' => 3,
            // ],
        ];

        foreach ($rewards as $index => $reward) {
            LoyaltyReward::updateOrCreate(
                ['title' => $reward['title']],
                array_merge($reward, ['sort_order' => $reward['sort_order'] ?? ($index + 1)])
            );
        }
    }
}
