<?php

namespace Database\Seeders;

use App\Models\Ecommerce\PaymentGateway;
use Illuminate\Database\Seeder;

class PaymentGatewaySeeder extends Seeder
{
    public function run(): void
    {
        PaymentGateway::updateOrCreate(
            ['key' => 'billplz'],
            ['name' => 'Billplz', 'is_active' => false, 'is_default' => false]
        );

        PaymentGateway::updateOrCreate(
            ['key' => 'manual_bank_transfer'],
            ['name' => 'Manual Bank Transfer', 'is_active' => true, 'is_default' => true]
        );

        PaymentGateway::updateOrCreate(
            ['key' => 'manual_bank_transfer'],
            ['name' => 'Manual Bank Transfer', 'is_active' => true, 'is_default' => true]
        );
    }   
}
