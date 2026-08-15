<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ProductVariantBundleItem;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Services\Ecommerce\PickupFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class Phase8PickupFulfillmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_list_only_offers_active_pickup_enabled_branches(): void
    {
        $available = $this->branch('A');
        $this->branch('B', false, true);
        $this->branch('C', true, false);

        $this->getJson('/api/public/shop/store-locations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $available->id)
            ->assertJsonPath('data.0.name', 'Branch A');
    }

    public function test_one_branch_must_fulfil_every_item_without_cross_branch_borrowing(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        [$x, $y] = [$this->product('X'), $this->product('Y')];
        $this->sellAt($x, $a, $b); $this->sellAt($y, $a, $b);
        $this->inventory($a, $x, 1); $this->inventory($a, $y, 0);
        $this->inventory($b, $x, 0); $this->inventory($b, $y, 1);
        $items = [$this->item($x), $this->item($y)];

        $this->assertFalse(app(PickupFulfillmentService::class)->assess($a->id, $items)['available']);
        $this->assertFalse(app(PickupFulfillmentService::class)->assess($b->id, $items)['available']);
    }

    public function test_product_availability_is_required_even_when_branch_stock_exists(): void
    {
        $branch = $this->branch('A');
        $product = $this->product('X');
        $this->inventory($branch, $product, 20);

        $assessment = app(PickupFulfillmentService::class)->assess($branch->id, [$this->item($product)]);
        $this->assertFalse($assessment['available']);
        $this->assertSame('product_unavailable', $assessment['unavailable_items'][0]['code']);

        $this->sellAt($product, $branch);
        $this->assertTrue(app(PickupFulfillmentService::class)->assess($branch->id, [$this->item($product)])['available']);
    }

    public function test_exact_variant_and_branch_inventory_is_used(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('SHIRT');
        $red = $this->variant($product, 'RED'); $blue = $this->variant($product, 'BLUE');
        $this->sellAt($product, $a, $b);
        $this->inventory($a, $product, 0, $red); $this->inventory($a, $product, 10, $blue);
        $this->inventory($b, $product, 10, $red);

        $assessment = app(PickupFulfillmentService::class)->assess($a->id, [$this->item($product, $red, 1)]);
        $this->assertFalse($assessment['available']);
        $this->assertSame('insufficient_branch_stock', $assessment['unavailable_items'][0]['code']);
    }

    public function test_bundle_components_are_aggregated_and_all_must_be_available(): void
    {
        $branch = $this->branch('A');
        $product = $this->product('KIT');
        $one = $this->variant($product, 'ONE'); $two = $this->variant($product, 'TWO');
        $bundle = $this->variant($product, 'BUNDLE', true);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $one->id, 'quantity' => 2]);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $two->id, 'quantity' => 1]);
        $this->sellAt($product, $branch);
        $this->inventory($branch, $product, 4, $one); $this->inventory($branch, $product, 1, $two);

        $this->expectException(ValidationException::class);
        app(PickupFulfillmentService::class)->validate($branch->id, [$this->item($product, $bundle, 2)]);
    }

    public function test_inactive_or_non_pickup_branch_is_rejected(): void
    {
        $branch = $this->branch('A', false, true);
        $assessment = app(PickupFulfillmentService::class)->assess($branch->id, []);
        $this->assertFalse($assessment['available']);
        $this->assertSame('pickup_branch_unavailable', $assessment['unavailable_items'][0]['code']);
    }

    private function branch(string $code, bool $active = true, bool $pickup = true): StoreLocation
    {
        $branch = StoreLocation::create(['name' => "Branch {$code}", 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => $active, 'is_pickup_available' => $pickup]);
        BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => BranchInventoryCutoverState::ACTIVE, 'activated_at' => now()]);
        return $branch;
    }

    private function product(string $sku): Product
    {
        return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => $sku.uniqid(), 'type' => 'single', 'price' => 1, 'stock' => 20, 'stock_quantity' => 20, 'track_stock' => true, 'is_active' => true]);
    }

    private function variant(Product $product, string $sku, bool $bundle = false): ProductVariant
    {
        return ProductVariant::create(['product_id' => $product->id, 'sku' => $sku.uniqid(), 'title' => $sku, 'stock' => 20, 'track_stock' => true, 'is_bundle' => $bundle, 'is_active' => true]);
    }

    private function sellAt(Product $product, StoreLocation ...$branches): void
    {
        $product->storeLocations()->syncWithoutDetaching(collect($branches)->mapWithKeys(fn ($branch) => [$branch->id => ['is_available' => true]])->all());
    }

    private function inventory(StoreLocation $branch, Product $product, int $quantity, ?ProductVariant $variant = null): void
    {
        StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => $quantity]);
    }

    private function item(Product $product, ?ProductVariant $variant = null, int $quantity = 1): array
    {
        return ['product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => $quantity];
    }
}
