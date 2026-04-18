<?php

namespace Database\Seeders;

use App\Models\Ecommerce\CustomerType;
use Illuminate\Database\Seeder;

class CustomerTypeSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['product', 'nail salon'] as $name) {
            CustomerType::firstOrCreate([
                'name' => $name,
            ]);
        }
    }
}
