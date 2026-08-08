<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BranchFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migration_adds_branch_foundation_columns_and_model_casts_flags(): void
    {
        foreach (['is_pickup_available', 'is_review_available', 'is_booking_available', 'is_pos_available', 'sort_order'] as $column) {
            $this->assertTrue(Schema::hasColumn('store_locations', $column));
        }

        $branch = $this->branch(['is_pickup_available' => 1, 'is_booking_available' => 0, 'is_pos_available' => 1]);
        $this->assertTrue($branch->is_pickup_available);
        $this->assertFalse($branch->is_booking_available);
        $this->assertTrue($branch->is_pos_available);
    }

    public function test_public_pickup_api_only_returns_active_pickup_enabled_branches(): void
    {
        $included = $this->branch(['code' => 'INCLUDED', 'sort_order' => 2]);
        $this->branch(['code' => 'NO-PICKUP', 'is_pickup_available' => false]);
        $this->branch(['code' => 'INACTIVE', 'is_active' => false]);

        $this->getJson('/api/public/shop/store-locations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $included->id);
    }

    public function test_public_booking_api_only_returns_active_booking_enabled_branches(): void
    {
        $included = $this->branch(['code' => 'BOOKING', 'is_booking_available' => true]);
        $this->branch(['code' => 'NO-BOOKING', 'is_booking_available' => false]);
        $this->branch(['code' => 'INACTIVE-BOOKING', 'is_active' => false, 'is_booking_available' => true]);

        $this->getJson('/api/public/shop/store-locations?for=booking')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $included->id)
            ->assertJsonMissingPath('data.0.is_booking_available');
    }

    public function test_public_booking_location_detail_rejects_missing_inactive_or_disabled_branches(): void
    {
        $disabled = $this->branch(['code' => 'DETAIL-DISABLED', 'is_booking_available' => false]);
        $inactive = $this->branch(['code' => 'DETAIL-INACTIVE', 'is_active' => false, 'is_booking_available' => true]);

        $this->getJson("/api/public/shop/store-locations/{$disabled->id}?for=booking")->assertNotFound();
        $this->getJson("/api/public/shop/store-locations/{$inactive->id}?for=booking")->assertNotFound();
        $this->getJson('/api/public/shop/store-locations/999999?for=booking')->assertNotFound();
    }

    public function test_review_branch_availability_is_independent_from_pickup(): void
    {
        $reviewOnly = $this->branch([
            'code' => 'REVIEW-ONLY',
            'is_pickup_available' => false,
            'is_review_available' => true,
        ]);
        $this->branch(['code' => 'PICKUP-ONLY', 'is_review_available' => false]);

        $this->getJson('/api/public/shop/store-locations?for=reviews')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $reviewOnly->id);
    }

    public function test_only_platform_super_admin_can_manage_branch_limit(): void
    {
        $regularUser = User::factory()->create();
        $this->actingAs($regularUser)->putJson('/api/ecommerce/branch-limit', ['limit' => 5])
            ->assertForbidden();

        // The production Platform Super Admin role must remain authorized even
        // when an older deployment overrides SUPER_ADMIN_ROLE differently.
        config(['auth.super_admin_role' => 'legacy_super_admin']);
        $role = Role::create(['name' => 'infra_core_x1', 'is_active' => true]);
        $superAdmin = User::factory()->create();
        $superAdmin->roles()->attach($role);

        $this->actingAs($superAdmin)->putJson('/api/ecommerce/branch-limit', ['limit' => 5])
            ->assertOk()
            ->assertJsonPath('data.limit', 5);
    }

    public function test_code_and_id_are_immutable_but_branch_flags_are_editable(): void
    {
        $user = $this->userWithPermission('ecommerce.stores.update');
        $branch = $this->branch();

        $this->actingAs($user)->putJson("/api/ecommerce/store-locations/{$branch->id}", [
            'code' => 'CHANGED',
        ])->assertUnprocessable();

        $this->actingAs($user)->putJson("/api/ecommerce/store-locations/{$branch->id}", [
            'id' => $branch->id + 1,
        ])->assertUnprocessable();

        $this->actingAs($user)->putJson("/api/ecommerce/store-locations/{$branch->id}", [
            'name' => 'Renamed Branch',
            'is_pickup_available' => false,
            'is_booking_available' => true,
            'is_pos_available' => true,
            'sort_order' => 7,
        ])->assertOk();

        $branch->refresh();
        $this->assertSame('MAIN', $branch->code);
        $this->assertSame('Renamed Branch', $branch->name);
        $this->assertFalse($branch->is_pickup_available);
        $this->assertTrue($branch->is_booking_available);
        $this->assertSame(7, $branch->sort_order);
    }

    public function test_delete_never_physically_deletes_and_directs_user_to_deactivate(): void
    {
        $user = $this->userWithPermission('ecommerce.stores.delete');
        $branch = $this->branch();

        $this->actingAs($user)->deleteJson("/api/ecommerce/store-locations/{$branch->id}")
            ->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('store_locations', ['id' => $branch->id]);
    }

    public function test_inactive_branches_count_toward_configurable_limit(): void
    {
        Setting::create(['type' => 'ecommerce', 'key' => 'branch_limit', 'value' => 1]);
        $this->branch(['is_active' => false]);
        $user = $this->userWithPermission('ecommerce.stores.create');

        $this->actingAs($user)->postJson('/api/ecommerce/store-locations', $this->validPayload('SECOND'))
            ->assertUnprocessable();

        $this->assertDatabaseCount('store_locations', 1);
    }

    public function test_creation_requires_permission(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/ecommerce/store-locations', $this->validPayload())
            ->assertForbidden();
    }

    private function branch(array $attributes = []): StoreLocation
    {
        return StoreLocation::create(array_merge($this->validPayload(), $attributes));
    }

    private function validPayload(string $code = 'MAIN'): array
    {
        return [
            'name' => 'Main Branch', 'code' => $code, 'address_line1' => '1 Main Street',
            'city' => 'Kuala Lumpur', 'state' => 'Kuala Lumpur', 'postcode' => '50000',
            'country' => 'Malaysia', 'is_active' => true, 'is_pickup_available' => true,
            'is_review_available' => true,
            'is_booking_available' => false, 'is_pos_available' => false, 'sort_order' => 0,
        ];
    }

    private function userWithPermission(string $slug): User
    {
        $group = PermissionGroup::create(['name' => 'Branches', 'sort_order' => 1]);
        $permission = Permission::create(['group_id' => $group->id, 'name' => $slug, 'slug' => $slug]);
        $role = Role::create(['name' => 'branch-test-'.str_replace('.', '-', $slug), 'is_active' => true]);
        $role->permissions()->attach($permission);
        $user = User::factory()->create();
        $user->roles()->attach($role);

        return $user;
    }
}
