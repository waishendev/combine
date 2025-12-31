<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class FooterWidgetSeederReal extends Seeder
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
                        'instagram' =>'https://www.instagram.com/gentlegurls__/?hl=en',
                        'facebook' => '',
                        'tiktok' => '',
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