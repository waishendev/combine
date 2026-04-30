<?php

namespace Database\Seeders;

use App\Models\Booking\BookingProduct;
use Illuminate\Database\Seeder;

class BookingProductSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'name' => 'Hair Treatment Add-on',
                'price' => 39.00,
                'barcode' => null,
                'description' => 'Express treatment booster during appointment.',
                'image_path' => null,
                'category' => 'Treatment',
                'is_active' => true,
            ],
            [
                'name' => 'Scalp Ampoule',
                'price' => 25.00,
                'barcode' => null,
                'description' => 'Scalp nourishing ampoule add-on.',
                'image_path' => null,
                'category' => 'Scalp Care',
                'is_active' => true,
            ],
            [
                'name' => 'Premium Wash Add-on',
                'price' => 18.00,
                'barcode' => null,
                'description' => 'Premium wash and rinse upgrade.',
                'image_path' => null,
                'category' => 'Wash',
                'is_active' => true,
            ],
            [
                'name' => 'Styling Add-on',
                'price' => 22.00,
                'barcode' => null,
                'description' => 'Quick styling finish add-on.',
                'image_path' => null,
                'category' => 'Styling',
                'is_active' => true,
            ],
        ];

        foreach ($rows as $row) {
            BookingProduct::query()->updateOrCreate(
                ['name' => $row['name']],
                $row,
            );
        }
    }
}
