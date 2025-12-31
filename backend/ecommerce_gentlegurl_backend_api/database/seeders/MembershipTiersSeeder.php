<?php

namespace Database\Seeders;

use App\Models\Ecommerce\LoyaltySetting;
use Illuminate\Database\Seeder;

class LoyaltySettingSeeder extends Seeder
{

    public function run(): void
    {
        LoyaltySetting::firstOrCreate([], [
            'base_multiplier' => 1,
            'expiry_months' => 12,
            'evaluation_cycle_months' => 6,
            'rules_effective_at' => null,
        ]);
    }   
}
