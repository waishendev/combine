<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds `ecommerce.order_reserve_minutes` only — safe to run alone on staging/production.
 *
 * php artisan db:seed --class=OrderReserveMinutesSettingSeeder
 */
class OrderReserveMinutesSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            ['type' => 'ecommerce', 'key' => 'ecommerce.order_reserve_minutes'],
            ['value' => 30]
        );
    }
}
