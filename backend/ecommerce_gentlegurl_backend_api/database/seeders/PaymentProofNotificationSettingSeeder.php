<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Standalone seeder — safe to run on a live database.
 *
 * php artisan db:seed --class=PaymentProofNotificationSettingSeeder
 */
class PaymentProofNotificationSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'booking_payment_proof_notification'],
            ['value' => [
                'enabled' => true,
                'email' => 'gentlegurls@gmail.com',
            ]]
        );

        Setting::updateOrCreate(
            ['type' => 'ecommerce', 'key' => 'ecommerce_payment_proof_notification'],
            ['value' => [
                'enabled' => true,
                'email' => 'gentlegurls@gmail.com',
            ]]
        );

        $this->command->info('Payment proof notification settings seeded.');
    }
}
