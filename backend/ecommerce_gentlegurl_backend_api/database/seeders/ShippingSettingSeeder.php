<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class ShippingSettingSeeder extends Seeder
{
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'shipping'],
            [
                'value' => [
                    'enabled' => true,
                    'currency' => 'MYR',
                    'label' => 'Delivery',
                    'free_shipping' => [
                        'enabled' => true,
                        'min_order_amount' => 200,
                    ],
                    'zones' => [
                        'MY_WEST' => [
                            'label' => 'Malaysia (West)',
                            'countries' => ['MY'],
                            'states' => [
                                'Johor',
                                'Kedah',
                                'Kelantan',
                                'Kuala Lumpur',
                                'Melaka',
                                'Negeri Sembilan',
                                'Pahang',
                                'Penang',
                                'Perak',
                                'Perlis',
                                'Putrajaya',
                                'Selangor',
                                'Terengganu',
                            ],
                            'fee' => 10,
                        ],
                        'MY_EAST' => [
                            'label' => 'Malaysia (East)',
                            'countries' => ['MY'],
                            'states' => ['Sabah', 'Sarawak', 'Labuan'],
                            'fee' => 20,
                        ],
                        'SG' => [
                            'label' => 'Singapore',
                            'countries' => ['SG'],
                            'states' => [],
                            'fee' => 25,
                        ],
                    ],
                    'fallback' => [
                        'mode' => 'block_checkout',
                        'default_fee' => 0,
                    ],
                ],
            ]
        );
    }
}
