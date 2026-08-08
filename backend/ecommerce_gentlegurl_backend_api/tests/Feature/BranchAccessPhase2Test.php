<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BranchAccessPhase2Test extends TestCase
{
    use RefreshDatabase;

    private Role $adminRole;
    private Role $platformRole;
    private Permission $assignPermission;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminRole = Role::create(['name' => 'admin', 'is_active' => true, 'is_system' => false, 'is_default' => true]);
        $this->platformRole = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true, 'is_default' => false]);
        $this->assignPermission = Permission::create(['slug' => 'branch_access.assign', 'name' => 'Assign Branch Access']);
        $this->platformRole->permissions()->syncWithoutDetaching([$this->assignPermission->id]);
    }

    public function test_relationships_and_duplicate_assignment_prevention(): void
    {
        $user = $this->user();
        $location = $this->location('PNG');

        $user->storeLocations()->attach($location->id);

        $this->assertTrue($user->storeLocations()->whereKey($location->id)->exists());
        $this->assertTrue($location->users()->whereKey($user->id)->exists());
        $this->assertDatabaseHas('store_location_user', ['user_id' => $user->id, 'store_location_id' => $location->id]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $user->storeLocations()->attach($location->id);
    }

    public function test_access_service_assigned_unassigned_multiple_revoked_and_inactive_behavior(): void
    {
        $user = $this->user();
        $first = $this->location('PNG', ['sort_order' => 2]);
        $second = $this->location('KL', ['sort_order' => 1]);
        $inactive = $this->location('OLD', ['is_active' => false, 'sort_order' => 3]);
        $unassigned = $this->location('JB');
        $service = app(StoreLocationAccessService::class);

        $user->storeLocations()->sync([$first->id, $second->id, $inactive->id]);

        $this->assertTrue($service->canAccessStoreLocation($user, $first));
        $this->assertFalse($service->canAccessStoreLocation($user, $unassigned));
        $this->assertSame([$second->id, $first->id, $inactive->id], $service->accessibleStoreLocations($user)->pluck('id')->all());
        $this->assertTrue($service->canAccessStoreLocation($user, $inactive, true));
        $this->assertFalse($service->canAccessStoreLocation($user, $inactive, false));

        $user->storeLocations()->detach($first->id);
        $this->assertFalse($service->canAccessStoreLocation($user->fresh(), $first));
    }

    public function test_platform_super_admin_bypasses_pivot_rows(): void
    {
        $platform = $this->user(['email' => 'platform@example.com']);
        $platform->roles()->sync([$this->platformRole->id]);
        $location = $this->location('NEW');

        $service = app(StoreLocationAccessService::class);

        $this->assertTrue($service->canAccessStoreLocation($platform, $location));
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $platform->id, 'store_location_id' => $location->id]);
    }

    public function test_normal_application_super_admin_has_no_platform_bypass(): void
    {
        config(['auth.super_admin_role' => 'superAdmin']);

        $normalSuperAdminRole = Role::create([
            'name' => 'superAdmin',
            'is_active' => true,
            'is_system' => false,
            'is_default' => false,
        ]);
        $normalSuperAdmin = $this->user(['email' => 'normal-super-admin@example.com']);
        $normalSuperAdmin->roles()->sync([$normalSuperAdminRole->id]);
        $branchA = $this->location('A');
        $branchB = $this->location('B');
        $normalSuperAdmin->storeLocations()->sync([$branchA->id]);

        $service = app(StoreLocationAccessService::class);

        $this->assertFalse($service->hasPlatformBypass($normalSuperAdmin));
        $this->assertTrue($service->canAccessStoreLocation($normalSuperAdmin, $branchA));
        $this->assertFalse($service->canAccessStoreLocation($normalSuperAdmin, $branchB));
    }

    public function test_normal_super_admin_with_two_assignments_receives_both_branch_options(): void
    {
        $role = Role::create(['name' => 'superAdmin', 'is_active' => true, 'is_system' => false, 'is_default' => false]);
        $user = $this->user(['email' => 'multi-super-admin@example.com']);
        $user->roles()->sync([$role->id]);
        $branchA = $this->location('SA');
        $branchB = $this->location('SB');
        $user->storeLocations()->sync([$branchA->id, $branchB->id]);

        $this->actingAs($user)->getJson('/api/me/store-locations')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $branchA->id])
            ->assertJsonFragment(['id' => $branchB->id]);
    }

    public function test_current_user_accessible_store_locations_api(): void
    {
        $user = $this->user();
        $assigned = $this->location('PNG', ['name' => 'Gentlegurls Nail Salon']);
        $this->location('HIDDEN', ['name' => 'Hidden Branch']);
        $user->storeLocations()->sync([$assigned->id]);

        $response = $this->actingAs($user)->getJson('/api/me/store-locations');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $assigned->id)
            ->assertJsonPath('data.0.name', 'Gentlegurls Nail Salon')
            ->assertJsonMissing(['name' => 'Hidden Branch']);
    }

    public function test_platform_user_receives_all_branch_options_from_current_user_api(): void
    {
        $platform = $this->user(['email' => 'platform-options@example.com']);
        $platform->roles()->sync([$this->platformRole->id]);
        $first = $this->location('PNG');
        $second = $this->location('KL');

        $this->actingAs($platform)->getJson('/api/me/store-locations')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $first->id])
            ->assertJsonFragment(['id' => $second->id]);
    }

    public function test_admin_create_update_branch_assignments_and_unauthorized_attempts(): void
    {
        $actor = $this->user(['email' => 'actor@example.com']);
        $actor->roles()->sync([$this->platformRole->id]);
        $branchA = $this->location('A');
        $branchB = $this->location('B');

        $created = $this->actingAs($actor)->postJson('/api/admins', [
            'email' => 'new-admin@example.com',
            'password' => 'password',
            'role_ids' => [$this->adminRole->id],
            'store_location_ids' => [$branchA->id, $branchB->id],
        ]);

        $created->assertOk()->assertJsonCount(2, 'data.store_locations');
        $admin = User::where('email', 'new-admin@example.com')->firstOrFail();
        $this->assertSameCanonicalizing([$branchA->id, $branchB->id], $admin->storeLocations()->pluck('store_locations.id')->all());

        $limitedActor = $this->user(['email' => 'limited@example.com']);
        $limitedActor->roles()->sync([$this->adminRole->id]);
        $limitedActor->storeLocations()->sync([$branchA->id]);

        $this->actingAs($limitedActor)->putJson("/api/admins/{$admin->id}", [
            'email' => 'new-admin@example.com',
            'role_ids' => [$this->adminRole->id],
            'store_location_ids' => [$branchB->id],
        ])->assertForbidden();

        $this->actingAs($actor)->putJson("/api/admins/{$admin->id}", [
            'email' => 'new-admin@example.com',
            'role_ids' => [$this->adminRole->id],
            'store_location_ids' => [$branchA->id],
        ])->assertOk()->assertJsonCount(1, 'data.store_locations');
    }

    public function test_existing_admin_api_remains_backward_compatible_without_branch_payload(): void
    {
        $actor = $this->user(['email' => 'actor2@example.com']);
        $actor->roles()->sync([$this->platformRole->id]);

        $response = $this->actingAs($actor)->postJson('/api/admins', [
            'email' => 'compat@example.com',
            'password' => 'password',
            'role_ids' => [$this->adminRole->id],
        ]);

        $response->assertOk()->assertJsonPath('data.email', 'compat@example.com');
    }

    public function test_admin_update_expands_one_branch_assignment_to_two(): void
    {
        $actor = $this->user(['email' => 'assignment-actor@example.com']);
        $actor->roles()->sync([$this->platformRole->id]);
        $admin = $this->user(['email' => 'assignment-target@example.com']);
        $branchA = $this->location('UA');
        $branchB = $this->location('UB');
        $admin->storeLocations()->sync([$branchA->id]);

        $this->actingAs($actor)->putJson("/api/admins/{$admin->id}", [
            'email' => $admin->email,
            'role_ids' => [$this->adminRole->id],
            'store_location_ids' => [$branchA->id, $branchB->id],
        ])->assertOk()->assertJsonCount(2, 'data.store_locations');

        $this->assertSameCanonicalizing([$branchA->id, $branchB->id], $admin->storeLocations()->pluck('store_locations.id')->all());
    }

    public function test_backfill_command_requires_store_code(): void
    {
        $this->artisan('branch-access:backfill')
            ->expectsOutput('The --store-code option is required. Example: php artisan branch-access:backfill --store-code=PNG --dry-run')
            ->assertExitCode(1);
    }

    public function test_backfill_command_fails_for_unknown_or_inactive_code_without_writing(): void
    {
        $user = $this->user(['email' => 'unknown-code@example.com']);
        $inactive = $this->location('OLD', ['is_active' => false]);
        $this->location('PNG');

        $this->artisan('branch-access:backfill --store-code=NOPE')
            ->expectsOutput('No active StoreLocation exists with code [NOPE]. This command will not create a Branch or fallback to another Branch.')
            ->assertExitCode(1);

        $this->artisan('branch-access:backfill --store-code=OLD')
            ->expectsOutput('No active StoreLocation exists with code [OLD]. This command will not create a Branch or fallback to another Branch.')
            ->assertExitCode(1);

        $this->assertDatabaseMissing('store_location_user', ['user_id' => $user->id]);
        $this->assertSame(2, StoreLocation::count());
    }

    public function test_backfill_command_requires_force_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $user = $this->user(['email' => 'production-no-force@example.com']);
        $this->location('PNG');

        $this->artisan('branch-access:backfill --store-code=PNG')
            ->expectsOutput('Refusing to run in production without --force. Re-run with --force after reviewing --dry-run output.')
            ->assertExitCode(1);

        $this->assertDatabaseMissing('store_location_user', ['user_id' => $user->id]);
    }

    public function test_backfill_command_with_force_assigns_only_unassigned_non_platform_users_idempotently(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $selected = $this->location('PNG');
        $other = $this->location('KL');
        $unassigned = $this->user(['email' => 'needs-branch@example.com']);
        $alreadyAssigned = $this->user(['email' => 'already-branch@example.com']);
        $alreadyAssigned->storeLocations()->attach($other->id);
        $platform = $this->user(['email' => 'platform-branch@example.com']);
        $platform->roles()->sync([$this->platformRole->id]);

        $this->artisan('branch-access:backfill --store-code=PNG --force')
            ->expectsOutput('Branch access backfill summary')
            ->assertExitCode(0);
        $this->artisan('branch-access:backfill --store-code=PNG --force')
            ->expectsOutput('Branch access backfill summary')
            ->assertExitCode(0);

        $this->assertDatabaseHas('store_location_user', ['user_id' => $unassigned->id, 'store_location_id' => $selected->id]);
        $this->assertDatabaseHas('store_location_user', ['user_id' => $alreadyAssigned->id, 'store_location_id' => $other->id]);
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $alreadyAssigned->id, 'store_location_id' => $selected->id]);
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $platform->id]);
        $this->assertSame(2, \Illuminate\Support\Facades\DB::table('store_location_user')->count());
        $this->assertSame(2, StoreLocation::count());
    }

    public function test_backfill_command_dry_run_writes_nothing(): void
    {
        $user = $this->user(['email' => 'dry-run@example.com']);
        $this->location('PNG');
        $permissionCount = Permission::count();

        $this->artisan('branch-access:backfill --store-code=PNG --dry-run')
            ->expectsOutput('DRY RUN: no permissions, pivot assignments, StoreLocation data, or business records will be written.')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('store_location_user', ['user_id' => $user->id]);
        $this->assertSame($permissionCount, Permission::count());
    }

    public function test_normal_super_admin_active_branch_backfill_is_additive_idempotent_and_not_a_bypass(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $normalRole = Role::create(['name' => 'superAdmin', 'is_active' => true, 'is_system' => false, 'is_default' => false]);
        $normal = $this->user(['email' => 'production-super-admin@example.com']);
        $normal->roles()->sync([$normalRole->id]);
        $activeA = $this->location('BA');
        $activeB = $this->location('BB');
        $inactive = $this->location('BI', ['is_active' => false]);
        $normal->storeLocations()->attach($activeA->id);

        $command = 'branch-access:backfill --all-active-super-admins --force';
        $this->artisan($command)->expectsOutput('Normal superAdmin active Branch backfill summary')->assertExitCode(0);
        $this->artisan($command)->expectsOutput('Assignments added: 0')->assertExitCode(0);

        $this->assertSameCanonicalizing([$activeA->id, $activeB->id], $normal->storeLocations()->pluck('store_locations.id')->all());
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $normal->id, 'store_location_id' => $inactive->id]);

        $future = $this->location('BF');
        $this->assertFalse(app(StoreLocationAccessService::class)->canAccessStoreLocation($normal->fresh(), $future));
        $this->assertSame(2, $normal->storeLocations()->count());
    }

    public function test_default_branch_backfill_seeder_assigns_existing_non_platform_users_idempotently(): void
    {
        $default = $this->location('PNG', ['sort_order' => 99]);
        $fallback = $this->location('AAA', ['sort_order' => 1]);
        $admin = $this->user(['email' => 'backfill@example.com']);
        $platform = $this->user(['email' => 'backfill-platform@example.com']);
        $platform->roles()->sync([$this->platformRole->id]);

        $this->seed(\Database\Seeders\BranchAccessDefaultStoreLocationSeeder::class);
        $this->seed(\Database\Seeders\BranchAccessDefaultStoreLocationSeeder::class);

        $this->assertDatabaseHas('store_location_user', ['user_id' => $admin->id, 'store_location_id' => $default->id]);
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $platform->id, 'store_location_id' => $default->id]);
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $admin->id, 'store_location_id' => $fallback->id]);
        $this->assertSame(1, $admin->storeLocations()->count());
    }

    private function user(array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Test Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'is_active' => true,
        ], $attributes));

        $user->roles()->syncWithoutDetaching([$this->adminRole->id]);

        return $user;
    }

    private function location(string $code, array $attributes = []): StoreLocation
    {
        return StoreLocation::create(array_merge([
            'name' => "{$code} Branch",
            'code' => $code,
            'address_line1' => 'Address',
            'city' => 'City',
            'state' => 'State',
            'postcode' => '10000',
            'country' => 'Malaysia',
            'is_active' => true,
            'is_pickup_available' => true,
            'is_booking_available' => true,
            'is_pos_available' => true,
            'sort_order' => 0,
        ], $attributes));
    }
}
