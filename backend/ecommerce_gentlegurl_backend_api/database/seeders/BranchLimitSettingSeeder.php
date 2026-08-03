<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Services\BranchCapacityService;
use Illuminate\Database\Seeder;

class BranchLimitSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            [
                'type' => 'ecommerce',
                'key' => BranchCapacityService::SETTING_KEY,
            ],
            ['value' => BranchCapacityService::DEFAULT_LIMIT]
        );
    }
}
