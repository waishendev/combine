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
                            'free_shipping' => [
                                'enabled' => true,
                                'min_order_amount' => 200,
                            ],
                        ],
                        'MY_EAST' => [
                            'label' => 'Malaysia (East)',
                            'countries' => ['MY'],
                            'states' => ['Sabah', 'Sarawak', 'Labuan'],
                            'fee' => 20,
                            'free_shipping' => [
                                'enabled' => true,
                                'min_order_amount' => 300,
                            ],
                        ],
                        'SG' => [
                            'label' => 'Singapore',
                            'countries' => ['SG'],
                            'states' => [],
                            'fee' => 25,
                            'free_shipping' => [
                                'enabled' => false,
                                'min_order_amount' => null,
                            ],
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
