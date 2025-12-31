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
                    'flat_fee' => 0,
                    'currency' => 'MYR',
                    'label' => 'Flat Rate Shipping',
                ],
            ]
        );
    }
}
