<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'shop_contact_widget'],
            [
                'value' => [
                    'whatsapp' => [
                        'enabled' => true,
                        'phone' => '+60123456789',
                        'default_message' => 'Hi, I would like to ask about your products.',
                    ],
                ],
            ]
        );

        // Setting::updateOrCreate(
        //     ['key' => 'homepage_products'],
        //     [
        //         'value' => [
        //             'new_products_days' => 30,
        //             'best_sellers_days' => 60,
        //         ],
        //     ]
        // );

        Setting::updateOrCreate(
            ['key' => 'new_products'],
            ['value' => ['days' => 30]]
        );

        Setting::updateOrCreate(
            ['key' => 'best_sellers'],
            ['value' => ['days' => 60]]
        );

        Setting::updateOrCreate(
            ['key' => 'page_reviews'],
            ['value' => ['enabled' => true]]
        );

        Setting::updateOrCreate(
            ['key' => 'product_reviews'],
            ['value' => ['enabled' => true, 'review_window_days' => 30]]
        );
    }
}
