<?php

namespace Database\Seeders;

use App\Models\Ecommerce\PosCashPoolAccount;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationPosSetting;
use Illuminate\Database\Seeder;

class PosBranchOperationalSeeder extends Seeder
{
    public function run(): void
    {
        $default = StoreLocation::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->first();
        if (! $default) return;
        PosCashPoolAccount::query()->firstOrCreate(
            ['store_location_id' => $default->id, 'code' => PosCashPoolAccount::DEFAULT_CODE],
            ['total_initial_cash' => 0, 'total_withdraw' => 0]
        );
        StoreLocationPosSetting::query()->firstOrCreate(['store_location_id' => $default->id]);
    }
}
