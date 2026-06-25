<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds `booking_max_advance_days` only when missing — safe to run alone on staging/production.
 *
 * php artisan db:seed --class=BookingMaxAdvanceDaysSettingSeeder
 */
class BookingMaxAdvanceDaysSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            ['type' => 'booking', 'key' => 'booking_max_advance_days'],
            ['value' => 60]
        );
    }
}
