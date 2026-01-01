<?php

namespace Database\Seeders;

use App\Models\Ecommerce\PaymentGateway;
use Illuminate\Database\Seeder;

class PaymentGatewaySeeder extends Seeder
{
    public function run(): void
    {
        PaymentGateway::updateOrCreate(
            ['key' => 'billplz_fpx'],
            ['name' => 'Online Banking (Billplz FPX)', 'is_active' => true, 'is_default' => true]
        );

        PaymentGateway::updateOrCreate(
            ['key' => 'manual_transfer'],
            ['name' => 'Manual Bank Transfer', 'is_active' => true, 'is_default' => true]
        );

        PaymentGateway::updateOrCreate(
            ['key' => 'billplz_card'],
            ['name' => 'Credit Card (Billplz)', 'is_active' => true, 'is_default' => false]
        );
    }   
}
