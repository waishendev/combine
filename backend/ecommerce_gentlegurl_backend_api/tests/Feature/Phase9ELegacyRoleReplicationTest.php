<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class Phase9ELegacyRoleReplicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_replicates_independent_roles_permissions_and_only_authorized_user_assignments_idempotently(): void
    {
        $png = $this->branch('PNG'); $xxxx = $this->branch('XXXX');
        $permission = Permission::create(['name' => 'POS View', 'slug' => 'pos.view']);
        $legacy = Role::create(['name' => 'Manager', 'description' => 'Operations', 'is_active' => true, 'is_system' => false]);
        $platform = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        $system = Role::create(['name' => 'Platform Auditor', 'is_active' => true, 'is_system' => true]);
        $legacy->permissions()->attach($permission);
        $both = $this->user('both@example.test', [$png->id, $xxxx->id]);
        $pngOnly = $this->user('png@example.test', [$png->id]);
        $xxxxOnly = $this->user('xxxx@example.test', [$xxxx->id]);
        $legacy->users()->attach([$both->id, $pngOnly->id, $xxxxOnly->id]);
        $both->roles()->attach([$platform->id, $system->id]);
        $accessBefore = \DB::table('store_location_user')->orderBy('user_id')->orderBy('store_location_id')->get()->toArray();

        $this->assertSame(0, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG,XXXX', '--force' => true]));
        $pngRole = Role::where('store_location_id', $png->id)->where('name', 'Manager')->firstOrFail();
        $xxxxRole = Role::where('store_location_id', $xxxx->id)->where('name', 'Manager')->firstOrFail();
        $this->assertNotSame($pngRole->id, $xxxxRole->id);
        $this->assertSame([$permission->id], $pngRole->permissions()->pluck('permissions.id')->all());
        $this->assertSame([$permission->id], $xxxxRole->permissions()->pluck('permissions.id')->all());
        $this->assertDatabaseCount('permissions', 1);
        $this->assertAssignment($both, $png, $pngRole); $this->assertAssignment($both, $xxxx, $xxxxRole);
        $this->assertAssignment($pngOnly, $png, $pngRole); $this->assertNoAssignment($pngOnly, $xxxx, $xxxxRole);
        $this->assertAssignment($xxxxOnly, $xxxx, $xxxxRole); $this->assertNoAssignment($xxxxOnly, $png, $pngRole);
        $this->assertEquals($accessBefore, \DB::table('store_location_user')->orderBy('user_id')->orderBy('store_location_id')->get()->toArray());
        $this->assertDatabaseHas('roles', ['id' => $legacy->id, 'store_location_id' => null]);
        $this->assertDatabaseMissing('role_user', ['role_id' => $legacy->id]);
        $this->assertDatabaseHas('role_user', ['user_id' => $both->id, 'role_id' => $platform->id]);
        $this->assertDatabaseHas('role_user', ['user_id' => $both->id, 'role_id' => $system->id]);
        $this->assertSame(0, Role::whereIn('name', ['infra_core_x1', 'Platform Auditor'])->whereNotNull('store_location_id')->count());

        $this->assertSame(0, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG,XXXX', '--force' => true]));
        $this->assertSame(2, Role::where('name', 'Manager')->whereNotNull('store_location_id')->count());
        $this->assertSame(4, \DB::table('role_user_store_location')->count());
    }

    public function test_dry_run_writes_nothing_and_preserves_platform_and_system_roles(): void
    {
        config(['multi_branch.platform_global_role_names' => ['infra_core_x1', 'Audit System']]);
        $png = $this->branch('PNG'); $xxxx = $this->branch('XXXX');
        $manager = Role::create(['name' => 'Manager', 'is_active' => true, 'is_system' => false]);
        $platform = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        $system = Role::create(['name' => 'Audit System', 'is_active' => true, 'is_system' => true]);
        $user = $this->user('admin@example.test', [$png->id, $xxxx->id]);
        $user->roles()->attach([$manager->id, $platform->id, $system->id]);

        $this->assertSame(0, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG,XXXX', '--dry-run' => true]));
        $this->assertStringContainsString('DRY RUN ONLY — NO DATA CHANGED', Artisan::output());
        $this->assertDatabaseCount('roles', 3);
        $this->assertDatabaseCount('role_user_store_location', 0);
        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $platform->id]);
        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $system->id]);
    }

    public function test_customized_existing_branch_role_is_a_conflict_and_is_not_overwritten(): void
    {
        $png = $this->branch('PNG');
        $baseline = Permission::create(['name' => 'Booking View', 'slug' => 'booking.view']);
        $custom = Permission::create(['name' => 'Inventory Edit', 'slug' => 'inventory.edit']);
        $legacy = Role::create(['name' => 'Manager', 'is_active' => true, 'is_system' => false]);
        $legacy->permissions()->attach($baseline);
        $existing = Role::create(['name' => 'Manager', 'store_location_id' => $png->id, 'is_active' => true, 'is_system' => false]);
        $existing->permissions()->attach($custom);
        $user = $this->user('admin@example.test', [$png->id]); $legacy->users()->attach($user);

        $this->assertSame(1, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG', '--force' => true]));
        $this->assertStringContainsString('customized/different', Artisan::output());
        $this->assertSame([$custom->id], $existing->permissions()->pluck('permissions.id')->all());
        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $legacy->id]);
        $this->assertDatabaseCount('role_user_store_location', 0);
    }

    public function test_protected_builtin_operational_role_is_replicated_and_existing_matching_copy_is_reused(): void
    {
        $png = $this->branch('PNG'); $second = $this->branch('asdsadas');
        $permission = Permission::create(['name' => 'Staff POS', 'slug' => 'pos.checkout']);
        $legacy = Role::create(['name' => 'Staff', 'is_active' => true, 'is_system' => true]);
        $legacy->permissions()->attach($permission);
        $existing = Role::create(['name' => 'Staff', 'store_location_id' => $png->id, 'is_active' => true, 'is_system' => true]);
        $existing->permissions()->attach($permission);
        $user = $this->user('staff@example.test', [$png->id, $second->id]);
        $legacy->users()->attach($user);

        $this->assertSame(0, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG,asdsadas', '--force' => true]));
        $this->assertSame($existing->id, Role::where('store_location_id', $png->id)->where('name', 'Staff')->value('id'));
        $secondRole = Role::where('store_location_id', $second->id)->where('name', 'Staff')->firstOrFail();
        $this->assertTrue($secondRole->is_system);
        $this->assertSame([$permission->id], $secondRole->permissions()->pluck('permissions.id')->all());
        $this->assertAssignment($user, $png, $existing);
        $this->assertAssignment($user, $second, $secondRole);
        $this->assertDatabaseHas('roles', ['id' => $legacy->id, 'store_location_id' => null, 'is_system' => true]);
    }

    public function test_previous_admin_copy_is_reused_while_missing_target_copy_is_created(): void
    {
        $png = $this->branch('PNG'); $second = $this->branch('asdsadas');
        $permission = Permission::create(['name' => 'Admin View', 'slug' => 'admins.view']);
        $legacy = Role::create(['name' => 'Admin', 'is_active' => true, 'is_system' => false]);
        $legacy->permissions()->attach($permission);
        $existing = Role::create(['name' => 'Admin', 'store_location_id' => $png->id, 'is_active' => true, 'is_system' => false]);
        $existing->permissions()->attach($permission);

        $this->assertSame(0, Artisan::call('role-branch:replicate', ['--store-codes' => 'PNG,asdsadas', '--force' => true]));
        $this->assertSame($existing->id, Role::where('store_location_id', $png->id)->where('name', 'Admin')->value('id'));
        $this->assertDatabaseHas('roles', ['store_location_id' => $second->id, 'name' => 'Admin']);
        $this->assertSame(2, Role::where('name', 'Admin')->whereNotNull('store_location_id')->count());
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['code' => $code, 'name' => "Branch {$code}", 'address' => 'Test', 'is_active' => true]);
    }

    private function user(string $email, array $branchIds): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'password', 'is_active' => true]);
        $user->storeLocations()->attach($branchIds); return $user;
    }

    private function assertAssignment(User $user, StoreLocation $branch, Role $role): void
    {
        $this->assertDatabaseHas('role_user_store_location', ['user_id' => $user->id, 'store_location_id' => $branch->id, 'role_id' => $role->id]);
    }

    private function assertNoAssignment(User $user, StoreLocation $branch, Role $role): void
    {
        $this->assertDatabaseMissing('role_user_store_location', ['user_id' => $user->id, 'store_location_id' => $branch->id, 'role_id' => $role->id]);
    }
}
