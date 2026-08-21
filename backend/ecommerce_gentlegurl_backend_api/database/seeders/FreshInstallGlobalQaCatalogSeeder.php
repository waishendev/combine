<?php

namespace Database\Seeders;

use App\Models\Booking\BookingService;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Staff;
use Illuminate\Database\Seeder;
use RuntimeException;

class FreshInstallGlobalQaCatalogSeeder extends Seeder
{
    public function run(): void
    {
        if (! config('multi_branch.fresh_seed_qa_data')) {
            return;
        }
        if (app()->environment('production')) {
            throw new RuntimeException('Fresh-install global QA catalogue cannot run in production.');
        }

        $categories = collect(['Nail Care', 'Beauty Care', 'QA Hidden Control'])->map(function (string $name, int $index) {
            return Category::query()->firstOrCreate(['slug' => 'mbqa-'.str($name)->slug()], [
                'name' => 'MBQA '.$name, 'description' => 'Fresh-install global QA identity',
                'is_active' => true, 'show_in_pos_filter' => true, 'sort_order' => 900 + $index,
            ]);
        });

        $products = collect(range(1, 9))->map(function (int $index) use ($categories) {
            $product = Product::query()->firstOrCreate(['sku' => sprintf('MBQA-GLOBAL-%03d', $index)], [
                'name' => sprintf('MBQA Global Product %03d', $index),
                'slug' => sprintf('mbqa-global-product-%03d', $index),
                'type' => $index === 2 ? 'variant' : 'single',
                'price' => 10 + $index,
                'cost_price' => 4 + $index,
                'stock' => 0,
                'stock_quantity' => 0,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
            ]);
            $category = $index === 9 ? $categories[2] : $categories[$index % 2];
            $product->categories()->syncWithoutDetaching([$category->id]);
            return $product;
        });

        ProductVariant::query()->firstOrCreate(['sku' => 'MBQA-GLOBAL-VARIANT-001'], [
            'product_id' => $products[1]->id, 'title' => 'MBQA Variant', 'price' => 15,
            'cost_price' => 7, 'stock' => 0, 'low_stock_threshold' => 5,
            'track_stock' => true, 'is_active' => true, 'sort_order' => 1,
        ]);

        $staffs = collect(range(1, 3))->map(fn (int $index) => Staff::query()->firstOrCreate(
            ['code' => sprintf('MBQA-STAFF-%03d', $index)],
            ['name' => "MBQA Staff {$index}", 'email' => "mbqa.staff{$index}@example.test", 'is_active' => true],
        ));
        collect(range(1, 3))->each(function (int $index) use ($staffs): void {
            $service = BookingService::query()->firstOrCreate(['name' => "MBQA Service {$index}"], [
                'service_type' => 'standard', 'service_price' => 30 + $index, 'price' => 30 + $index,
                'duration_min' => 60, 'deposit_amount' => 10, 'buffer_min' => 15,
                'is_active' => true, 'is_package_eligible' => true,
            ]);
            $service->allowedStaffs()->syncWithoutDetaching([
                $staffs[$index - 1]->id => ['is_active' => true],
            ]);
        });

        $this->command?->info('Prepared shared MBQA Product, Category, Staff and Booking Service identities.');
    }
}
