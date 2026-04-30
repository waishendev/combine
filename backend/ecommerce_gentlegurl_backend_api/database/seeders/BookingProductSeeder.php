<?php

namespace Database\Seeders;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingProductCategory;
use Illuminate\Database\Seeder;

class BookingProductSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Treatment', 'sort_order' => 1, 'is_active' => true],
            ['name' => 'Scalp Care', 'sort_order' => 2, 'is_active' => true],
            ['name' => 'Wash', 'sort_order' => 3, 'is_active' => true],
            ['name' => 'Styling', 'sort_order' => 4, 'is_active' => true],
        ];

        $categoryMap = [];
        foreach ($categories as $cat) {
            $row = BookingProductCategory::query()->updateOrCreate(['name' => $cat['name']], $cat);
            $categoryMap[$cat['name']] = (int) $row->id;
        }

        $rows = [
            ['name' => 'Hair Treatment Add-on', 'price' => 39.00, 'description' => 'Express treatment booster during appointment.', 'category' => 'Treatment'],
            ['name' => 'Scalp Ampoule', 'price' => 25.00, 'description' => 'Scalp nourishing ampoule add-on.', 'category' => 'Scalp Care'],
            ['name' => 'Premium Wash Add-on', 'price' => 18.00, 'description' => 'Premium wash and rinse upgrade.', 'category' => 'Wash'],
            ['name' => 'Styling Add-on', 'price' => 22.00, 'description' => 'Quick styling finish add-on.', 'category' => 'Styling'],
        ];

        foreach ($rows as $row) {
            BookingProduct::query()->updateOrCreate(['name' => $row['name']], [
                'price' => $row['price'],
                'barcode' => null,
                'description' => $row['description'],
                'image_path' => null,
                'category_id' => $categoryMap[$row['category']] ?? null,
                'is_active' => true,
            ]);
        }
    }
}
