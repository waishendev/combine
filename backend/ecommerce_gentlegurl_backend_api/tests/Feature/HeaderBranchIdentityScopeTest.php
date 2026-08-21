<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\Booking\CommissionTierController;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HeaderBranchIdentityScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_specific_branch_uses_assignment_pivot(): void
    {
        [$actor, $branchA, $branchB] = $this->actorAndBranches();
        $staffA = Staff::create(['name' => 'Staff A', 'email' => 'staff-a@example.com', 'is_active' => true]);
        $staffB = Staff::create(['name' => 'Staff B', 'email' => 'staff-b@example.com', 'is_active' => true]);
        $staffA->storeLocations()->attach($branchA);
        $staffB->storeLocations()->attach($branchB);

        $this->actingAs($actor)->getJson('/api/staffs?branch_store_location_id='.$branchA->id)
            ->assertOk()
            ->assertJsonFragment(['id' => $staffA->id])
            ->assertJsonMissing(['id' => $staffB->id]);
    }

    public function test_staff_and_admin_all_scope_excludes_inaccessible_assignments(): void
    {
        [$actor, $branchA, $branchB] = $this->actorAndBranches();
        $staffA = Staff::create(['name' => 'Staff A', 'email' => 'staff-all-a@example.com', 'is_active' => true]);
        $staffB = Staff::create(['name' => 'Staff B', 'email' => 'staff-all-b@example.com', 'is_active' => true]);
        $staffA->storeLocations()->attach($branchA);
        $staffB->storeLocations()->attach($branchB);
        $adminA = $this->user('admin-a@example.com');
        $adminB = $this->user('admin-b@example.com');
        $adminA->storeLocations()->attach($branchA);
        $adminB->storeLocations()->attach($branchB);

        $this->actingAs($actor)->getJson('/api/staffs?branch_scope=all')
            ->assertOk()->assertJsonFragment(['id' => $staffA->id])->assertJsonMissing(['id' => $staffB->id]);
        $this->actingAs($actor)->getJson('/api/admins?branch_scope=all')
            ->assertOk()->assertJsonFragment(['id' => $adminA->id])->assertJsonMissing(['id' => $adminB->id]);
    }

    public function test_admin_specific_branch_includes_assignment_and_platform_bypass_only_for_authorized_actor(): void
    {
        [$actor, $branchA, $branchB] = $this->actorAndBranches();
        $manageSystem = Permission::create(['slug' => 'admins.manage-system', 'name' => 'admins.manage-system']);
        $actor->roles()->first()->permissions()->attach($manageSystem);
        $adminA = $this->user('specific-a@example.com');
        $adminB = $this->user('specific-b@example.com');
        $platformRole = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true, 'is_default' => false]);
        $platform = User::create(['name' => 'Platform', 'email' => 'platform@example.com', 'password' => Hash::make('password'), 'is_active' => true]);
        $platform->roles()->attach($platformRole);
        $adminA->storeLocations()->attach($branchA);
        $adminB->storeLocations()->attach($branchB);

        $this->actingAs($actor)->getJson('/api/admins?branch_store_location_id='.$branchA->id)
            ->assertOk()
            ->assertJsonFragment(['id' => $adminA->id])
            ->assertJsonFragment(['id' => $platform->id])
            ->assertJsonMissing(['id' => $adminB->id]);
    }

    public function test_inaccessible_specific_branch_is_rejected_for_both_lists(): void
    {
        [$actor, , $branchB] = $this->actorAndBranches();

        $this->actingAs($actor)->getJson('/api/staffs?branch_store_location_id='.$branchB->id)->assertForbidden();
        $this->actingAs($actor)->getJson('/api/admins?branch_store_location_id='.$branchB->id)->assertForbidden();
    }

    public function test_commission_tiers_are_intentionally_global_definitions(): void
    {
        $tier = StaffCommissionTier::create(['type' => 'ECOMMERCE', 'min_sales' => 123, 'commission_percent' => 4]);
        $controller = app(CommissionTierController::class);
        $branchAResponse = $controller->index(Request::create('/tiers', 'GET', ['type' => 'ECOMMERCE', 'branch_store_location_id' => 100]));
        $branchBResponse = $controller->index(Request::create('/tiers', 'GET', ['type' => 'ECOMMERCE', 'branch_store_location_id' => 200]));

        $branchAIds = collect($branchAResponse->getData(true)['data']['data'])->pluck('id')->all();
        $branchBIds = collect($branchBResponse->getData(true)['data']['data'])->pluck('id')->all();
        $this->assertContains($tier->id, $branchAIds);
        $this->assertSame($branchAIds, $branchBIds);
        $this->assertFalse(Schema::hasColumn('staff_commission_tiers', 'store_location_id'));
    }

    private function actorAndBranches(): array
    {
        $branchA = $this->branch('A');
        $branchB = $this->branch('B');
        $actor = $this->user('actor@example.com');
        $actor->storeLocations()->attach($branchA);

        return [$actor, $branchA, $branchB];
    }

    private function user(string $email): User
    {
        $role = Role::firstOrCreate(['name' => 'admin'], ['is_active' => true, 'is_system' => false, 'is_default' => true]);
        foreach (['staff.view', 'users.view'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }
        $user = User::create(['name' => $email, 'email' => $email, 'password' => Hash::make('password'), 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create([
            'name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x',
            'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true,
        ]);
    }
}
