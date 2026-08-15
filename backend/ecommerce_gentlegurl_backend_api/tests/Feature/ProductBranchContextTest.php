<?php

namespace Tests\Feature;

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class ProductBranchContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_assigns_only_missing_products_preserves_other_branches_and_inventory_and_is_idempotent(): void
    {
        $png = $this->branch('PNG'); $b = $this->branch('B');
        $one = $this->product('ONE', 0); $two = $this->product('TWO', 5);
        $one->storeLocations()->attach($b->id, ['is_available' => true]);
        $two->storeLocations()->attach($png->id, ['is_available' => false]);
        StoreLocationProductInventory::create(['store_location_id' => $png->id, 'product_id' => $one->id, 'quantity' => 12]);

        $this->artisan('product-branch:backfill', ['--store-code' => 'PNG', '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseMissing('store_location_product', ['store_location_id' => $png->id, 'product_id' => $one->id]);
        $arguments = ['--store-code' => 'PNG', '--force' => true];
        $this->artisan('product-branch:backfill', $arguments)->assertSuccessful();
        $this->artisan('product-branch:backfill', $arguments)->assertSuccessful();

        $this->assertDatabaseHas('store_location_product', ['store_location_id' => $png->id, 'product_id' => $one->id, 'is_available' => true]);
        $this->assertDatabaseHas('store_location_product', ['store_location_id' => $png->id, 'product_id' => $two->id, 'is_available' => false]);
        $this->assertDatabaseHas('store_location_product', ['store_location_id' => $b->id, 'product_id' => $one->id, 'is_available' => true]);
        $this->assertSame(3, \DB::table('store_location_product')->count());
        $this->assertDatabaseHas('store_location_product_inventories', ['store_location_id' => $png->id, 'product_id' => $one->id, 'quantity' => 12]);
    }

    public function test_product_list_uses_availability_not_inventory_or_stock_quantity(): void
    {
        $png = $this->branch('PNG'); $b = $this->branch('B');
        $pngZero = $this->product('PNG-ZERO', 0); $bProduct = $this->product('B', 0); $inventoryOnly = $this->product('INVENTORY-ONLY', 20);
        $pngZero->storeLocations()->attach($png->id, ['is_available' => true]);
        $bProduct->storeLocations()->attach($b->id, ['is_available' => true]);
        StoreLocationProductInventory::create(['store_location_id' => $png->id, 'product_id' => $inventoryOnly->id, 'quantity' => 99]);

        $this->assertSame([$pngZero->id], $this->productIds($png->id));
        $this->assertSame([$bProduct->id], $this->productIds($b->id));
        $this->assertEqualsCanonicalizing([$pngZero->id, $bProduct->id, $inventoryOnly->id], $this->productIds(null));
    }

    public function test_categories_remain_global_while_product_counts_follow_branch_availability(): void
    {
        $png = $this->branch('PNG'); $b = $this->branch('B');
        $category = Category::create(['name' => 'Global', 'slug' => 'global', 'is_active' => true]);
        $empty = Category::create(['name' => 'Empty', 'slug' => 'empty', 'is_active' => true]);
        $pngProduct = $this->product('PNG', 0); $bProduct = $this->product('B', 0);
        $category->products()->attach([$pngProduct->id, $bProduct->id]);
        $pngProduct->storeLocations()->attach($png->id, ['is_available' => true]);
        $bProduct->storeLocations()->attach($b->id, ['is_available' => true]);

        $pngRows = $this->categoryRows($png->id); $bRows = $this->categoryRows($b->id); $allRows = $this->categoryRows(null);
        $this->assertCount(2, $pngRows); $this->assertCount(2, $bRows); $this->assertCount(2, $allRows);
        $this->assertSame(1, $this->countFor($pngRows, $category->id));
        $this->assertSame(1, $this->countFor($bRows, $category->id));
        $this->assertSame(2, $this->countFor($allRows, $category->id));
        $this->assertSame(0, $this->countFor($pngRows, $empty->id));

        $category->update(['name' => 'Edited globally']);
        $this->assertSame(2, Category::query()->count(), 'Branch context must not clone Category identity.');
    }

    private function productIds(?int $branchId): array
    {
        $query = ['page' => 1, 'per_page' => 50, 'is_reward_only' => 'false'];
        if ($branchId) { $query['branch_store_location_id'] = $branchId; }
        $response = app(ProductController::class)->index(Request::create('/products', 'GET', $query));
        return collect($response->getData(true)['data']['data'])->pluck('id')->sort()->values()->all();
    }

    private function categoryRows(?int $branchId): array
    {
        $query = ['page' => 1, 'per_page' => 50];
        if ($branchId) { $query['branch_store_location_id'] = $branchId; }
        $response = app(CategoryController::class)->index(Request::create('/categories', 'GET', $query));
        return $response->getData(true)['data']['data'];
    }

    private function countFor(array $rows, int $categoryId): int
    {
        return (int) collect($rows)->firstWhere('id', $categoryId)['products_count'];
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true]);
    }

    private function product(string $sku, int $stock): Product
    {
        return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => uniqid($sku), 'type' => 'single', 'price' => 1,
            'stock' => $stock, 'stock_quantity' => $stock, 'track_stock' => true, 'is_active' => true]);
    }
}
