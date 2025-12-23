<?php

namespace Database\Seeders;

use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\Voucher;
use Illuminate\Database\Seeder;

class LoyaltyRewardSeeder extends Seeder
{
    public function run(): void
    {
        $voucherId = Voucher::query()->value('id');
        $productId = Product::where('is_active', true)->orderBy('id')->value('id')
            ?? Product::query()->orderBy('id')->value('id');

        $rewards = [
            [
                'title' => 'RM10 Discount Voucher',
                'description' => 'Redeem RM10 off your next purchase.',
                'type' => 'voucher',
                'points_required' => 500,
                'voucher_id' => $voucherId,
                'product_id' => null,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'title' => 'Free T-Shirt',
                'description' => 'Claim a free t-shirt with your points.',
                'type' => 'product',
                'points_required' => 800,
                'product_id' => $productId,
                'voucher_id' => null,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'title' => 'Free Gift (In-store)',
                'description' => 'Collect a complimentary in-store gift.',
                'type' => 'custom',
                'points_required' => 300,
                'product_id' => null,
                'voucher_id' => null,
                'is_active' => true,
                'sort_order' => 3,
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
