<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InitializeBranchInventoryFromGlobalTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_product_and_exact_variant_stock_initialize_only_at_target_and_bundle_is_skipped(): void
    {
        $png = $this->branch('PNG'); $other = $this->branch('B');
        $single = $this->product('SINGLE', 15);
        $variantProduct = $this->product('VARIANT', 99);
        $red = $this->variant($variantProduct, 'RED', 7);
        $bundle = $this->variant($variantProduct, 'BUNDLE', 500, true);

        $this->artisan('branch-inventory:initialize', ['--store-code' => 'PNG', '--from-global' => true, '--force' => true])->assertSuccessful();

        $this->assertInventory($png, $single, null, 15);
        $this->assertInventory($png, $variantProduct, $red, 7);
        $this->assertDatabaseMissing('store_location_product_inventories', ['store_location_id' => $png->id, 'product_id' => $variantProduct->id, 'product_variant_id' => null]);
        $this->assertDatabaseMissing('store_location_product_inventories', ['store_location_id' => $png->id, 'product_variant_id' => $bundle->id]);
        $this->assertSame(0, StoreLocationProductInventory::query()->where('store_location_id', $other->id)->count());
    }

    public function test_dry_run_reports_but_performs_zero_writes(): void
    {
        $this->branch('PNG'); $this->product('P', 8);
        $this->artisan('branch-inventory:initialize', ['--store-code' => 'PNG', '--from-global' => true, '--dry-run' => true])
            ->expectsOutputToContain('Total quantity to initialize: 8')->expectsOutputToContain('zero writes occurred')->assertSuccessful();
        $this->assertDatabaseCount('store_location_product_inventories', 0);
        $this->assertDatabaseCount('product_stock_movements', 0);
    }

    public function test_invalid_inactive_and_active_target_branches_fail_closed(): void
    {
        $this->artisan('branch-inventory:initialize', ['--store-code' => 'MISSING', '--from-global' => true, '--dry-run' => true])->assertFailed();
        $inactive = $this->branch('OFF', false);
        $this->artisan('branch-inventory:initialize', ['--store-code' => $inactive->code, '--from-global' => true, '--dry-run' => true])->assertFailed();
        $active = $this->branch('LIVE');
        BranchInventoryCutoverState::create(['store_location_id' => $active->id, 'status' => BranchInventoryCutoverState::ACTIVE, 'activated_at' => now()]);
        $this->artisan('branch-inventory:initialize', ['--store-code' => $active->code, '--from-global' => true, '--dry-run' => true])->assertFailed();
    }

    public function test_conflicting_target_or_non_zero_other_branch_inventory_fails_safe(): void
    {
        $png = $this->branch('PNG'); $other = $this->branch('B'); $product = $this->product('P', 10);
        $this->stock($png, $product, 3);
        $this->artisan('branch-inventory:initialize', ['--store-code' => 'PNG', '--from-global' => true, '--dry-run' => true])->assertFailed();
        StoreLocationProductInventory::query()->delete();
        $this->stock($other, $product, 1);
        $this->artisan('branch-inventory:initialize', ['--store-code' => 'PNG', '--from-global' => true, '--force' => true])->assertFailed();
        $this->assertDatabaseMissing('store_location_product_inventories', ['store_location_id' => $png->id]);
    }

    public function test_repeated_matching_force_is_idempotent(): void
    {
        $png = $this->branch('PNG'); $product = $this->product('P', 10);
        $arguments = ['--store-code' => 'PNG', '--from-global' => true, '--force' => true];
        $this->artisan('branch-inventory:initialize', $arguments)->assertSuccessful();
        $this->artisan('branch-inventory:initialize', $arguments)->assertSuccessful();
        $this->assertInventory($png, $product, null, 10);
        $this->assertSame(1, ProductStockMovement::query()->where('idempotency_key', 'like', 'inventory-init:from-global:%')->count());
    }

    public function test_reviewed_json_workflow_remains_available(): void
    {
        $branch = $this->branch('A'); $product = $this->product('P', 100);
        $file = tempnam(sys_get_temp_dir(), 'branch-counts-');
        file_put_contents($file, json_encode([['store_code' => 'A', 'product_id' => $product->id, 'product_variant_id' => null, 'quantity' => 4]]));
        try {
            $this->artisan('branch-inventory:initialize', ['--file' => $file, '--dry-run' => true])->assertSuccessful();
            $this->assertDatabaseCount('store_location_product_inventories', 0);
            $this->artisan('branch-inventory:initialize', ['--file' => $file, '--force' => true])->assertSuccessful();
            $this->assertInventory($branch, $product, null, 4);
        } finally { @unlink($file); }
    }

    private function branch(string $code, bool $active = true): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => $active]);
    }

    private function product(string $sku, int $stock): Product
    {
        return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => uniqid($sku), 'type' => 'single', 'price' => 1,
            'stock' => $stock, 'stock_quantity' => $stock, 'track_stock' => true, 'is_active' => true]);
    }

    private function variant(Product $product, string $sku, int $stock, bool $bundle = false): ProductVariant
    {
        return ProductVariant::create(['product_id' => $product->id, 'sku' => uniqid($sku), 'title' => $sku, 'stock' => $stock,
            'track_stock' => true, 'is_bundle' => $bundle, 'is_active' => true]);
    }

    private function stock(StoreLocation $branch, Product $product, int $quantity): void
    {
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => null, 'quantity' => $quantity]);
    }

    private function assertInventory(StoreLocation $branch, Product $product, ?ProductVariant $variant, int $quantity): void
    {
        $this->assertDatabaseHas('store_location_product_inventories', ['store_location_id' => $branch->id, 'product_id' => $product->id,
            'product_variant_id' => $variant?->id, 'quantity' => $quantity]);
    }
}
