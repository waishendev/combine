<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class ShopContactWidgetSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'contact_widget'],
            [
                'value' => [
                    'whatsapp' => [
                        'enabled' => true,
                        'phone' => '+60123456789', // 纯数字 or 带 +60 都可以
                        'default_message' => 'Hi, I would like to ask about your products.',
                    ],
                    
                ],
            ]
        );
    }
}