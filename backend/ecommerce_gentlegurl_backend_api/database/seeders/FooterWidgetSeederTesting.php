<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class FooterWidgetSeederTesting extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'footer'],
            [
                'value' => [
                    'enabled' => true,
                    'about_text' => null,
                    'contact' => [
                        'whatsapp' => null,
                        'email' => null,
                        'address' => null,
                    ],
                    'social' => [
                        'instagram' =>'https://www.instagram.com/',
                        'facebook' => 'https://www.facebook.com/',
                        'tiktok' => 'https://www.tiktok.com/',
                    ],
                    'links' => [
                        'shipping_policy' => '/shipping-policy',
                        'return_refund' => '/return-refund',
                        'privacy' => '/privacy-policy',
                    ],
                ],
            ]
        );
    }
}