<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ProductVariantBundleItem;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\Promotion;
use App\Services\Ecommerce\OrderBranchInventoryService;
use App\Services\Ecommerce\ShippingFulfillmentService;
use App\Services\SettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class Phase8ShippingPromotionInventoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_shipping_uses_first_whole_cart_capable_configured_branch(): void
    {
        [$a, $b, $c] = [$this->branch('A'), $this->branch('B'), $this->branch('C')];
        [$x, $y] = [$this->product('X'), $this->product('Y')];
        foreach ([$a, $b, $c] as $branch) { $this->sellAt($x, $branch); $this->sellAt($y, $branch); }
        $this->stock($a, $x, 10); $this->stock($a, $y, 0);
        $this->stock($b, $x, 5); $this->stock($b, $y, 5);
        $this->stock($c, $x, 8); $this->stock($c, $y, 8);
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$a->id, $b->id, $c->id]);

        $selected = app(ShippingFulfillmentService::class)->selectBranch([$this->item($x), $this->item($y)]);
        $this->assertSame($b->id, $selected->id);

        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$c->id, $b->id, $a->id]);
        $this->assertSame($c->id, app(ShippingFulfillmentService::class)->selectBranch([$this->item($x), $this->item($y)])->id);
    }

    public function test_shipping_never_combines_branches_and_skips_inactive_branch(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        [$x, $y] = [$this->product('X'), $this->product('Y')];
        foreach ([$a, $b] as $branch) { $this->sellAt($x, $branch); $this->sellAt($y, $branch); }
        $this->stock($a, $x, 1); $this->stock($a, $y, 0);
        $this->stock($b, $x, 0); $this->stock($b, $y, 1);
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$a->id, $b->id]);

        $this->expectException(ValidationException::class);
        app(ShippingFulfillmentService::class)->selectBranch([$this->item($x), $this->item($y)]);
    }

    public function test_product_variant_and_bundle_shortages_fall_through_priority(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('KIT');
        $component = $this->variant($product, 'COMP');
        $bundle = $this->variant($product, 'BUNDLE', true);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $component->id, 'quantity' => 2]);
        $this->sellAt($product, $a); $this->sellAt($product, $b);
        $this->stock($a, $product, 1, $component); $this->stock($b, $product, 4, $component);
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$a->id, $b->id]);

        $this->assertSame($b->id, app(ShippingFulfillmentService::class)->selectBranch([$this->item($product, $bundle)])->id);
    }

    public function test_branch_reservation_and_release_are_isolated_and_idempotent(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('X'); $this->sellAt($product, $a); $this->sellAt($product, $b);
        $this->stock($a, $product, 5); $this->stock($b, $product, 10);
        $order = Order::create(['order_number' => 'P8-1', 'status' => 'pending', 'payment_status' => 'unpaid', 'pickup_or_shipping' => 'shipping', 'store_location_id' => $a->id, 'subtotal' => 1, 'discount_total' => 0, 'shipping_fee' => 0, 'grand_total' => 1]);
        $service = app(OrderBranchInventoryService::class);

        $service->reserve($order, [$this->item($product)], 30);
        $service->reserve($order, [$this->item($product)], 30);
        $this->assertSame(4, $this->quantity($a, $product));
        $this->assertSame(10, $this->quantity($b, $product));
        $this->assertSame(14, (int) $product->fresh()->stock, 'Legacy stock is a projection, not a second deduction.');

        $this->assertTrue($service->release($order));
        $this->assertTrue($service->release($order));
        $this->assertSame(5, $this->quantity($a, $product));
        $this->assertSame(10, $this->quantity($b, $product));
    }

    public function test_promotion_channels_are_independent_from_voucher_architecture(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $online = Promotion::create(['title' => 'Online', 'is_active' => true, 'is_online_enabled' => true]);
        $offline = Promotion::create(['title' => 'Offline A', 'is_active' => true, 'is_online_enabled' => false]);
        $offline->offlineStoreLocations()->sync([$a->id]);

        $this->assertTrue(Promotion::query()->online()->whereKey($online->id)->exists());
        $this->assertFalse(Promotion::query()->online()->whereKey($offline->id)->exists());
        $this->assertTrue(Promotion::query()->offlineAt($a->id)->whereKey($offline->id)->exists());
        $this->assertFalse(Promotion::query()->offlineAt($b->id)->whereKey($offline->id)->exists());
        $this->assertFalse(\Schema::hasTable('voucher_store_location'));
    }

    private function branch(string $code): StoreLocation
    {
        $branch = StoreLocation::create(['name' => "Branch {$code}", 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_pickup_available' => true]);
        BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => 'active', 'activated_at' => now()]);
        return $branch;
    }
    private function product(string $sku): Product { return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => uniqid($sku), 'type' => 'single', 'price' => 1, 'stock' => 0, 'stock_quantity' => 0, 'track_stock' => true, 'is_active' => true]); }
    private function variant(Product $product, string $sku, bool $bundle = false): ProductVariant { return ProductVariant::create(['product_id' => $product->id, 'sku' => uniqid($sku), 'title' => $sku, 'stock' => 0, 'track_stock' => true, 'is_bundle' => $bundle, 'is_active' => true]); }
    private function sellAt(Product $product, StoreLocation $branch): void { $product->storeLocations()->syncWithoutDetaching([$branch->id => ['is_available' => true]]); }
    private function stock(StoreLocation $branch, Product $product, int $qty, ?ProductVariant $variant = null): void { StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => $qty]); }
    private function quantity(StoreLocation $branch, Product $product): int { return (int) StoreLocationProductInventory::where('store_location_id', $branch->id)->where('product_id', $product->id)->whereNull('product_variant_id')->value('quantity'); }
    private function item(Product $product, ?ProductVariant $variant = null): array { return ['product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => 1]; }
}
