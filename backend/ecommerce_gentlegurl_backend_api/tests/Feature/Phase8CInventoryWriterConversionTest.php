<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PosCart;
use App\Models\Ecommerce\PosCartItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ProductVariantBundleItem;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\User;
use App\Services\Ecommerce\BranchInventoryActivationReadinessService;
use App\Services\Ecommerce\BranchInventoryMutationService;
use App\Services\Ecommerce\PosBranchInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class Phase8CInventoryWriterConversionTest extends TestCase
{
    use RefreshDatabase;

    public function test_pos_product_and_variant_sale_mutate_only_persisted_cart_branch(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = $this->product('P'); $red = $this->variant($product, 'RED'); $blue = $this->variant($product, 'BLUE');
        $this->sellAt($product, $a, $b);
        foreach ([[$a, $red, 5], [$a, $blue, 7], [$b, $red, 20], [$b, $blue, 30]] as [$branch, $variant, $qty]) { $this->stock($branch, $product, $qty, $variant); }
        $user = User::factory()->create();
        $cart = PosCart::create(['staff_user_id' => $user->id, 'store_location_id' => $a->id]);
        PosCartItem::create(['pos_cart_id' => $cart->id, 'variant_id' => $red->id, 'qty' => 2, 'price_snapshot' => 1]);
        $order = $this->order($a, 'POS-1');

        $this->assertTrue(app(PosBranchInventoryService::class)->deduct($cart, $order, null));
        $this->assertTrue(app(PosBranchInventoryService::class)->deduct($cart, $order, null));
        $this->assertSame(3, $this->qty($a, $product, $red));
        $this->assertSame(7, $this->qty($a, $product, $blue));
        $this->assertSame(20, $this->qty($b, $product, $red));
        $this->assertDatabaseHas('product_stock_movements', ['store_location_id' => $a->id, 'product_variant_id' => $red->id, 'quantity_delta' => -2]);
    }

    public function test_pos_bundle_is_atomic_and_cannot_borrow_another_branch(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')]; $product = $this->product('KIT');
        $one = $this->variant($product, 'ONE'); $two = $this->variant($product, 'TWO'); $bundle = $this->variant($product, 'BUNDLE', true);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $one->id, 'quantity' => 1]);
        ProductVariantBundleItem::create(['bundle_variant_id' => $bundle->id, 'component_variant_id' => $two->id, 'quantity' => 1]);
        $this->sellAt($product, $a, $b); $this->stock($a, $product, 1, $one); $this->stock($a, $product, 0, $two); $this->stock($b, $product, 10, $one); $this->stock($b, $product, 10, $two);
        $user = User::factory()->create();
        $cart = PosCart::create(['staff_user_id' => $user->id, 'store_location_id' => $a->id]); PosCartItem::create(['pos_cart_id' => $cart->id, 'variant_id' => $bundle->id, 'qty' => 1, 'price_snapshot' => 1]);
        try { app(PosBranchInventoryService::class)->deduct($cart, $this->order($a, 'POS-2'), null); $this->fail('Expected insufficient component.'); }
        catch (ValidationException) { $this->assertSame(1, $this->qty($a, $product, $one)); $this->assertSame(0, $this->qty($a, $product, $two)); }
    }

    public function test_canonical_adjustment_projection_and_replay_do_not_create_stock(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')]; $product = $this->product('P');
        $this->stock($a, $product, 5); $this->stock($b, $product, 10);
        $mutation = ['product_id' => $product->id, 'delta' => 2, 'type' => 'stock_in', 'idempotency_key' => 'crm:test:1'];
        app(BranchInventoryMutationService::class)->mutateMany($a->id, [$mutation]);
        app(BranchInventoryMutationService::class)->mutateMany($a->id, [$mutation]);
        $this->assertSame(7, $this->qty($a, $product)); $this->assertSame(10, $this->qty($b, $product));
        $this->assertSame(17, (int) $product->fresh()->stock);
    }

    public function test_activation_is_coordinated_and_fails_without_reviewed_complete_counts(): void
    {
        $branch = $this->branch('A', false); $product = $this->product('P'); $this->sellAt($product, $branch);
        $report = app(BranchInventoryActivationReadinessService::class)->analyse();
        $this->assertFalse($report['ready']); $this->assertSame('coordinated_all_active_branches', $report['activation_mode']);
        $this->artisan('branch-inventory:activate', ['--dry-run' => true])->assertFailed();
        $this->assertDatabaseMissing('branch_inventory_cutover_states', ['store_location_id' => $branch->id, 'status' => 'active']);
    }

    private function branch(string $code, bool $activeInventory = true): StoreLocation { $branch = StoreLocation::create(['name' => $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_pos_available' => true]); BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => $activeInventory ? 'active' : 'pending', 'activated_at' => $activeInventory ? now() : null]); return $branch; }
    private function product(string $sku): Product { return Product::create(['name' => $sku, 'slug' => strtolower($sku).uniqid(), 'sku' => uniqid($sku), 'type' => 'single', 'price' => 1, 'stock' => 0, 'stock_quantity' => 0, 'track_stock' => true, 'is_active' => true]); }
    private function variant(Product $product, string $sku, bool $bundle = false): ProductVariant { return ProductVariant::create(['product_id' => $product->id, 'sku' => uniqid($sku), 'title' => $sku, 'stock' => 0, 'track_stock' => true, 'is_bundle' => $bundle, 'is_active' => true]); }
    private function sellAt(Product $product, StoreLocation ...$branches): void { $product->storeLocations()->syncWithoutDetaching(collect($branches)->mapWithKeys(fn ($b) => [$b->id => ['is_available' => true]])->all()); }
    private function stock(StoreLocation $branch, Product $product, int $qty, ?ProductVariant $variant = null): void { StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $variant?->id, 'quantity' => $qty]); }
    private function qty(StoreLocation $branch, Product $product, ?ProductVariant $variant = null): int { return (int) StoreLocationProductInventory::where('store_location_id', $branch->id)->where('product_id', $product->id)->when($variant, fn ($q) => $q->where('product_variant_id', $variant->id), fn ($q) => $q->whereNull('product_variant_id'))->value('quantity'); }
    private function order(StoreLocation $branch, string $number): Order { return Order::create(['order_number' => $number, 'store_location_id' => $branch->id, 'status' => 'completed', 'payment_status' => 'paid', 'subtotal' => 1, 'discount_total' => 0, 'shipping_fee' => 0, 'grand_total' => 1]); }
}
