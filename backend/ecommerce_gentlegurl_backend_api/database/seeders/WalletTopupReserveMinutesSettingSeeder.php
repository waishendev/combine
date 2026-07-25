<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Services\Ecommerce\WalletTopupReserveService;
use Illuminate\Database\Seeder;

/**
 * Seeds wallet top-up payment reserve minutes for ecommerce + booking.
 * Safe to run alone on staging/production (does not wipe other data).
 *
 * php artisan db:seed --class=WalletTopupReserveMinutesSettingSeeder
 */
class WalletTopupReserveMinutesSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            [
                'type' => 'ecommerce',
                'key' => WalletTopupReserveService::ECOMMERCE_SETTING_KEY,
            ],
            ['value' => 30]
        );

        Setting::firstOrCreate(
            [
                'type' => 'booking',
                'key' => WalletTopupReserveService::BOOKING_SETTING_KEY,
            ],
            ['value' => 30]
        );

        $this->command?->info('Wallet top-up reserve minutes seeded (ecommerce + booking, default 30).');
    }
}
