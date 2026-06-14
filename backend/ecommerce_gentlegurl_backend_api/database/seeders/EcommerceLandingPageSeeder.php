<?php

namespace Database\Seeders;

use App\Models\Ecommerce\EcommerceLandingPage;
use Illuminate\Database\Seeder;

/**
 * Ecommerce shop homepage — Visit Our Studio block (separate from booking_landing_pages).
 *
 * Launch on live/staging (after migrate):
 *   php artisan db:seed --class=EcommerceLandingPageSeeder
 */
class EcommerceLandingPageSeeder extends Seeder
{
    public function run(): void
    {
        EcommerceLandingPage::updateOrCreate(
            ['slug' => 'home'],
            [
                'sections' => [
                    'slider_intro' => [
                        'is_active' => true,
                        'headline' => 'Effortless silhouettes, luxe textures, everyday confidence.',
                    ],
                    'hero' => [
                        'is_active' => true,
                        'label' => '',
                        'title' => '',
                        'subtitle' => '',
                        'title_2' => '',
                        'subtitle_2' => '',
                        'cta_label' => 'Shop Now',
                        'cta_link' => '/shop',
                    ],
                    'visit_studio' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => '',
                            'title' => 'Visit Our Studio',
                            'align' => 'left',
                        ],
                        'studio_name' => 'NAILSBYLITTLEBOO SALON',
                        'address' => "123 Example Street\nKuala Lumpur\nMalaysia",
                        'google_maps_url' => 'https://maps.google.com/',
                        'waze_url' => 'https://www.waze.com/',
                        'whatsapp_phone' => '60123456789',
                        'whatsapp_message' => 'Hi! I would like to get in touch about your shop.',
                        'google_maps_label' => 'GOOGLE MAPS',
                        'waze_label' => 'OPEN WAZE',
                        'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
                        'opening_hours_heading' => 'Opening Hours',
                        'opening_hours' => [
                            [
                                'day_range' => 'Monday — Friday',
                                'time_range' => '11:00 AM — 6:30 PM',
                            ],
                            [
                                'day_range' => 'Saturday — Sunday',
                                'time_range' => '9:00 AM — 4:30 PM',
                            ],
                        ],
                        'bottom_label' => "OPERATED BY DAUN SEGAR SDN BHD (1234567-A)\n© 2026 NAILSBYLITTLEBOO SALON",
                        'column_order' => 'contact_left',
                    ],
                ],
                'is_active' => true,
            ]
        );

        $this->command?->info('Ecommerce landing page (slug=home) seeded.');
    }
}
