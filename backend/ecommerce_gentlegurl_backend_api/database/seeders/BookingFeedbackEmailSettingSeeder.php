<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds `booking_feedback_email` only when missing — safe on staging/production.
 */
class BookingFeedbackEmailSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::firstOrCreate(
            ['type' => 'booking', 'key' => 'booking_feedback_email'],
            ['value' => [
                'enabled' => true,
                'send_at' => '10:00',
            ]]
        );
    }
}
