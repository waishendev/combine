<?php

namespace Database\Seeders;

use App\Models\Ecommerce\MembershipTierRule;
use Illuminate\Database\Seeder;

class LoyaltySettingSeeder extends Seeder
{


    public function run(): void
    {
        $tiers = [
            [
                'tier' => 'basic',
                'display_name' => 'Basic Member',
                'description' => 'Default membership tier',
                'badge_image_path' => null,
                'min_spent_last_x_months' => 0,
                'months_window' => 6,
                'multiplier' => 1,
                'product_discount_percent' => 1,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'tier' => 'silver',
                'display_name' => 'Silver Member',
                'description' => 'Silver membership tier',
                'badge_image_path' => null,
                'min_spent_last_x_months' => 10000,
                'months_window' => 6,
                'multiplier' => 1,
                'product_discount_percent' => 1,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'tier' => 'gold',
                'display_name' => 'Gold Member',
                'description' => 'Gold membership tier',
                'badge_image_path' => null,
                'min_spent_last_x_months' => 20000,
                'months_window' => 6,
                'multiplier' => 1,
                'product_discount_percent' => 1,
                'is_active' => true,
                'sort_order' => 3,
            ],
        ];
        
        foreach ($tiers as $tier) {
            MembershipTierRule::updateOrCreate(
                ['tier' => $tier['tier']],
                $tier
            );
        }
    }
}
