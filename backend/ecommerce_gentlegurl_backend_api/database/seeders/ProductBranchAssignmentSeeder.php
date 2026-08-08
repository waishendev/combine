<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Seeder;

class ProductBranchAssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $default = StoreLocation::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->first();
        if (! $default) {
            $this->command?->warn('No existing default Branch; Product availability assignment skipped.');
            return;
        }
        Product::query()->select('id')->chunkById(500, function ($products) use ($default) {
            foreach ($products as $product) {
                $product->storeLocations()->syncWithoutDetaching([$default->id => ['is_available' => true]]);
            }
        });
    }
}
