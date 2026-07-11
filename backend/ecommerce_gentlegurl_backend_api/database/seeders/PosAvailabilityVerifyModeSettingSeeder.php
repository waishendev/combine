<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds CRM POS availability verify mode only — safe to run alone on staging/production.
 *
 * holiday_only: block staff holidays/off-days/leave only (shop booking unaffected).
 * full: also enforce schedule + conflict checks in CRM POS.
 *
 * php artisan db:seed --class=PosAvailabilityVerifyModeSettingSeeder
 */
class PosAvailabilityVerifyModeSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'pos_availability_verify_mode'],
            ['value' => 'holiday_only']
        );

        $this->command?->info('POS availability verify mode set to holiday_only.');
    }
}
