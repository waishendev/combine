<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ProductVariantBundleItem;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Services\Ecommerce\BranchInventoryMutationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BranchInventoryPhase6BFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_variant_decrease_cannot_borrow_from_another_branch(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('SINGLE');
        foreach ([$a, $b] as $branch) { $this->activate($branch); }
        StoreLocationProductInventory::create(['store_location_id' => $a->id, 'product_id' => $product->id, 'quantity' => 1]);
        StoreLocationProductInventory::create(['store_location_id' => $b->id, 'product_id' => $product->id, 'quantity' => 20]);
        try {
            app(BranchInventoryMutationService::class)->mutateMany($a->id, [[
                'product_id' => $product->id, 'delta' => -2, 'type' => 'stock_out', 'idempotency_key' => 'sale:last-two',
            ]]);
            $this->fail('Branch A must not borrow Branch B stock.');
        } catch (ValidationException) {
            $this->assertSame(1, $this->qty($a, $product));
            $this->assertSame(20, $this->qty($b, $product));
            $this->assertDatabaseMissing('product_stock_movements', ['idempotency_key' => 'sale:last-two']);
        }
    }

    public function test_non_variant_and_variant_mutations_are_branch_isolated_and_reconciled(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('P');
        $red = $this->variant($product, 'RED');
        $blue = $this->variant($product, 'BLUE');
        foreach ([$a, $b] as $branch) {
            $this->activate($branch);
            foreach ([[$red, 5], [$blue, 7]] as [$variant, $qty]) {
                StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'quantity' => $qty]);
            }
        }
        $service = app(BranchInventoryMutationService::class);
        $movement = $service->mutateMany($a->id, [[
            'product_id' => $product->id, 'product_variant_id' => $red->id, 'delta' => -2,
            'type' => 'stock_out', 'idempotency_key' => 'sale:1:red',
        ]])->first();
        $this->assertSame(3, $this->qty($a, $product, $red));
        $this->assertSame(7, $this->qty($a, $product, $blue));
        $this->assertSame(5, $this->qty($b, $product, $red));
        $this->assertSame($a->id, $movement->store_location_id);
        $this->assertSame([-2, 5, 3], [$movement->quantity_delta, $movement->quantity_before, $movement->quantity_after]);
        $service->mutateMany($a->id, [['product_id' => $product->id, 'product_variant_id' => $red->id, 'delta' => -2, 'type' => 'stock_out', 'idempotency_key' => 'sale:1:red']]);
        $this->assertSame(3, $this->qty($a, $product, $red), 'Replay must not deduct twice.');
    }

    public function test_bundle_component_mutations_are_atomic_and_deterministic(): void
    {
        $branch = $this->branch('A'); $this->activate($branch);
        $product = $this->product('KIT');
        $one = $this->variant($product, 'ONE'); $two = $this->variant($product, 'TWO');
        $bundle = ProductVariant::create(['product_id' => $product->id, 'sku' => 'BUNDLE', 'title' => 'Bundle', 'is_bundle' => true, 'is_active' => true]);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $one->id, 'quantity' => 2, 'sort_order' => 0]);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $two->id, 'quantity' => 1, 'sort_order' => 1]);
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $one->id, 'quantity' => 4]);
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $two->id, 'quantity' => 0]);
        $service = app(BranchInventoryMutationService::class);
        try {
            $service->mutateMany($branch->id, $service->bundleDecrements($bundle, 1, 'sale:bundle'));
            $this->fail('Expected insufficient component stock.');
        } catch (ValidationException) {
            $this->assertSame(4, $this->qty($branch, $product, $one));
            $this->assertSame(0, $this->qty($branch, $product, $two));
        }
    }

    public function test_backfill_is_dry_run_safe_idempotent_and_protects_mismatches(): void
    {
        $branch = $this->branch('A');
        $single = $this->product('SINGLE', 8);
        $variantProduct = $this->product('VARIANT', 99);
        $this->variant($variantProduct, 'V1', 4);
        $this->artisan('branch-inventory:backfill', ['--store-code' => 'A', '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseCount('store_location_product_inventories', 0);
        $this->artisan('branch-inventory:backfill', ['--store-code' => 'A', '--force' => true])->assertSuccessful();
        $this->artisan('branch-inventory:backfill', ['--store-code' => 'A', '--force' => true])->assertSuccessful();
        $this->assertSame(8, $this->qty($branch, $single));
        $this->assertDatabaseCount('store_location_product_inventories', 2);
        $this->assertDatabaseHas('branch_inventory_cutover_states', ['store_location_id' => $branch->id, 'status' => BranchInventoryCutoverState::RECONCILED]);
        $this->assertDatabaseMissing('branch_inventory_cutover_states', ['store_location_id' => $branch->id, 'status' => BranchInventoryCutoverState::ACTIVE]);
    }

    private function branch(string $code): StoreLocation { return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true]); }
    private function product(string $sku, int $stock = 0): Product { return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => $sku.uniqid(), 'type' => 'single', 'price' => 1, 'cost_price' => 1, 'stock' => $stock, 'stock_quantity' => $stock, 'track_stock' => true, 'is_active' => true]); }
    private function variant(Product $product, string $sku, int $stock = 0): ProductVariant { return ProductVariant::create(['product_id' => $product->id, 'sku' => $sku.uniqid(), 'title' => $sku, 'stock' => $stock, 'cost_price' => 1, 'track_stock' => true, 'is_active' => true]); }
    private function activate(StoreLocation $branch): void { BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => BranchInventoryCutoverState::ACTIVE, 'activated_at' => now()]); }
    private function qty(StoreLocation $branch, Product $product, ?ProductVariant $variant = null): int { return (int) StoreLocationProductInventory::query()->where('store_location_id', $branch->id)->where('product_id', $product->id)->when($variant, fn ($query) => $query->where('product_variant_id', $variant->id), fn ($query) => $query->whereNull('product_variant_id'))->value('quantity'); }
}
