<?php

namespace Database\Seeders;

use App\Models\PosPaymentMethod;
use Illuminate\Database\Seeder;

class PosPaymentMethodDefinitionSeeder extends Seeder
{
    public const DEFINITIONS = [
        ['key' => 'cash', 'name' => 'Cash', 'default_sort_order' => 1],
        ['key' => 'qrpay', 'name' => 'QRPay', 'default_sort_order' => 2],
        ['key' => 'credit_card', 'name' => 'Credit Card', 'default_sort_order' => 3],
        ['key' => 'customer_balance', 'name' => 'Customer Balance', 'default_sort_order' => 4],
    ];

    public function run(): void
    {
        foreach (self::DEFINITIONS as $definition) {
            PosPaymentMethod::query()->firstOrCreate(
                ['key' => $definition['key']],
                $definition + ['is_system' => true],
            );
        }
    }
}
