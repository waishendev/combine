<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'key' => 'shop_contact_widget',
                'value' => [
                    'whatsapp' => [
                        'enabled' => true,
                        'phone' => '+0103870881',
                        'default_message' => 'Hi, I’d like to enquire about your nail & waxing services and beauty cosmetic products.',
                    ],
                ],
            ],
            ['key' => 'new_products', 'value' => ['days' => 30]],
            ['key' => 'best_sellers', 'value' => ['days' => 60]],
            ['key' => 'page_reviews', 'value' => ['enabled' => true]],
            ['key' => 'product_reviews', 'value' => ['enabled' => true, 'review_window_days' => 30]],
            ['key' => 'ecommerce.return_window_days', 'value' => 7],
            ['key' => 'ecommerce.return_tracking_submit_days', 'value' => 7],
        ];

        foreach (['ecommerce', 'booking'] as $type) {
            foreach ($rows as $row) {
                Setting::updateOrCreate(
                    ['type' => $type, 'key' => $row['key']],
                    ['value' => $row['value']]
                );
            }
        }

        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'booking_policy'],
            ['value' => [
                'reschedule' => [
                    'enabled' => true,
                    'max_changes' => 1,
                    'cutoff_hours' => 72,
                ],
                'cancel' => [
                    'customer_cancel_allowed' => false,
                    'deposit_refundable' => false,
                ],
            ]]
        );

        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'BOOKING_HOLD_MINUTES'],
            ['value' => 10]
        );

        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'booking_service_deposit_note'],
            ['value' => 'Note: The deposit is typically credited toward your final bill. The balance above is an estimate (menu price + add-ons − deposit). Packages, vouchers, tips, or changes at the chair may adjust the final amount—confirmed at checkout and at the salon.']
        );

        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'booking_reminder_email'],
            ['value' => [
                'enabled' => true,
                'send_at' => '10:00',
            ]]
        );
    }
}
