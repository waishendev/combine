<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductBranchPhase6ATest extends TestCase
{
    use RefreshDatabase;

    public function test_global_product_has_independent_unique_branch_assignments(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product();
        $product->storeLocations()->sync([$a->id => ['is_available' => true], $b->id => ['is_available' => true]]);
        $this->assertDatabaseCount('products', 1);
        $this->assertTrue($product->isAvailableAt($a) && $product->isAvailableAt($b));
        $product->storeLocations()->detach($b);
        $this->assertTrue($product->isAvailableAt($a));
        $this->assertFalse($product->isAvailableAt($b));

        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('store_location_product')->insert(['product_id' => $product->id, 'store_location_id' => $a->id, 'is_available' => true]);
    }

    public function test_inventory_foundation_disambiguates_product_and_variant_rows(): void
    {
        $branch = $this->branch('A');
        $product = $this->product();
        $variant = ProductVariant::create(['product_id' => $product->id, 'sku' => 'V-1', 'title' => 'Red', 'stock' => 12]);
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'quantity' => 0]);
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'quantity' => 0]);
        $this->assertDatabaseCount('store_location_product_inventories', 2);
        $this->assertSame(12, (int) $variant->fresh()->stock);
        $this->assertSame(5, (int) $product->fresh()->stock);
        $this->expectException(\Illuminate\Database\QueryException::class);
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'quantity' => 9]);
    }

    public function test_backfill_dry_run_is_zero_write_and_force_is_idempotent_without_inventory(): void
    {
        $branch = $this->branch('A');
        $this->product();
        $this->artisan('product-branch:backfill', ['--store-code' => $branch->code, '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseCount('store_location_product', 0);
        $this->artisan('product-branch:backfill', ['--store-code' => $branch->code, '--force' => true])->assertSuccessful();
        $this->artisan('product-branch:backfill', ['--store-code' => $branch->code, '--force' => true])->assertSuccessful();
        $this->assertDatabaseCount('store_location_product', 1);
        $this->assertDatabaseCount('store_location_product_inventories', 0);
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => "Branch {$code}", 'code' => $code, 'address_line1' => 'Test', 'city' => 'Test', 'state' => 'Test', 'postcode' => '10000', 'is_active' => true, 'is_pos_available' => true]);
    }

    private function product(): Product
    {
        return Product::create(['name' => 'Global Product', 'slug' => 'global-product-'.uniqid(), 'sku' => uniqid('SKU-'), 'type' => 'single', 'price' => 10, 'stock' => 5, 'stock_quantity' => 5, 'track_stock' => true, 'is_active' => true]);
    }
}
