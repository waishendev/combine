<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationProductInventory;
use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Services\Ecommerce\ShippingFulfillmentService;
use App\Services\Ecommerce\OrderBranchInventoryService;
use App\Services\SettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EcommerceFulfilmentPriorityTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_initialization_is_dry_run_then_idempotent_force(): void
    {
        $png = $this->branch('PNG');

        $this->artisan('ecommerce-fulfilment-priority:initialize', ['--store-code' => 'PNG', '--dry-run' => true])
            ->expectsOutputToContain('zero writes')
            ->assertSuccessful();
        $this->assertDatabaseMissing('settings', ['key' => ShippingFulfillmentService::SETTING_KEY]);

        $this->artisan('ecommerce-fulfilment-priority:initialize', ['--store-code' => 'PNG', '--force' => true])->assertSuccessful();
        $this->assertSame([$png->id], $this->priority());
        $this->artisan('ecommerce-fulfilment-priority:initialize', ['--store-code' => 'PNG', '--force' => true])
            ->expectsOutputToContain('no changes')
            ->assertSuccessful();
        $this->assertSame([$png->id], $this->priority());
    }

    public function test_reconciliation_preserves_manual_order_and_appends_missing_branches(): void
    {
        [$png, $b, $c] = [$this->branch('PNG'), $this->branch('B'), $this->branch('C')];
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$c->id, $png->id]);

        $this->artisan('ecommerce-fulfilment-priority:initialize', ['--store-code' => 'PNG', '--force' => true])->assertSuccessful();

        $this->assertSame([$c->id, $png->id, $b->id], $this->priority());
    }

    public function test_canonical_branch_creation_appends_in_creation_order_without_duplicates(): void
    {
        Setting::create(['type' => 'ecommerce', 'key' => 'branch_limit', 'value' => 10]);
        $user = $this->userWithCreatePermission();
        $png = $this->branch('PNG');
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$png->id]);

        $b = $this->actingAs($user)->postJson('/api/ecommerce/store-locations', $this->payload('B'))->assertOk()->json('data');
        $c = $this->actingAs($user)->postJson('/api/ecommerce/store-locations', $this->payload('C'))->assertOk()->json('data');
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [(int) $c['id'], $png->id, (int) $b['id']]);
        $d = $this->actingAs($user)->postJson('/api/ecommerce/store-locations', $this->payload('D'))->assertOk()->json('data');

        $this->assertSame([(int) $c['id'], $png->id, (int) $b['id'], (int) $d['id']], $this->priority());
        $this->assertCount(4, array_unique($this->priority()));
    }

    public function test_inactive_first_branch_is_never_selected_and_reactivation_restores_priority(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $product = Product::create(['name' => 'Item', 'slug' => 'item', 'sku' => 'ITEM', 'type' => 'single', 'price' => 1, 'stock' => 10, 'stock_quantity' => 10, 'track_stock' => true, 'is_active' => true]);
        foreach ([$a, $b] as $branch) {
            BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => 'active', 'activated_at' => now()]);
            $product->storeLocations()->attach($branch->id, ['is_available' => true]);
            StoreLocationProductInventory::create(['store_location_id' => $branch->id, 'product_id' => $product->id, 'quantity' => 5]);
        }
        SettingService::set(ShippingFulfillmentService::SETTING_KEY, [$a->id, $b->id]);
        $a->update(['is_active' => false]);

        $item = [['product_id' => $product->id, 'product_variant_id' => null, 'quantity' => 1]];
        $selected = app(ShippingFulfillmentService::class)->selectBranch($item, true);
        $this->assertSame($b->id, $selected->id);
        $order = Order::create(['order_number' => 'INACTIVE-SKIP', 'status' => 'pending', 'payment_status' => 'unpaid', 'pickup_or_shipping' => 'shipping', 'store_location_id' => $selected->id, 'subtotal' => 1, 'discount_total' => 0, 'shipping_fee' => 0, 'grand_total' => 1]);
        app(OrderBranchInventoryService::class)->reserve($order, $item, 30);
        $this->assertSame(5, (int) StoreLocationProductInventory::where('store_location_id', $a->id)->value('quantity'));
        $this->assertSame(4, (int) StoreLocationProductInventory::where('store_location_id', $b->id)->value('quantity'));

        $a->update(['is_active' => true]);
        $this->assertSame($a->id, app(ShippingFulfillmentService::class)->selectBranch($item)->id);
        $this->assertSame([$a->id, $b->id], $this->priority());
    }

    private function priority(): array
    {
        return Setting::where('key', ShippingFulfillmentService::SETTING_KEY)->firstOrFail()->value;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create($this->payload($code));
    }

    private function payload(string $code): array
    {
        return ['name' => "Branch {$code}", 'code' => $code, 'address_line1' => '1 Main Street', 'city' => 'KL', 'state' => 'KL', 'postcode' => '50000', 'country' => 'Malaysia', 'is_active' => true, 'is_pickup_available' => true, 'is_review_available' => true, 'is_booking_available' => false, 'is_pos_available' => false, 'sort_order' => 0];
    }

    private function userWithCreatePermission(): User
    {
        $group = PermissionGroup::create(['name' => 'Branches', 'sort_order' => 1]);
        $permission = Permission::create(['group_id' => $group->id, 'name' => 'Create Branch', 'slug' => 'ecommerce.stores.create']);
        $role = Role::create(['name' => 'priority-branch-creator', 'is_active' => true]);
        $role->permissions()->attach($permission);
        $user = User::factory()->create();
        $user->roles()->attach($role);
        return $user;
    }
}
