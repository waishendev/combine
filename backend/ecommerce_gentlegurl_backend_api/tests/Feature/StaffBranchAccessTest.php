<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use App\Services\StaffBranchAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StaffBranchAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_create_and_edit_synchronize_work_at_with_login_access(): void
    {
        $platformRole = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        $actor = User::factory()->create();
        $actor->roles()->attach($platformRole);
        $first = $this->branch('CREATE');
        $second = $this->branch('EDIT');

        $created = $this->actingAs($actor)->postJson('/api/staffs', [
            'name' => 'Branch Staff',
            'email' => 'branch-staff@example.test',
            'password' => 'password',
            'store_location_ids' => [$first->id],
        ])->assertSuccessful();

        $staff = Staff::findOrFail($created->json('data.staff.id'));
        $user = $staff->admin()->firstOrFail();
        $this->assertDatabaseHas('store_location_user', ['user_id' => $user->id, 'store_location_id' => $first->id]);

        $this->actingAs($actor)->putJson("/api/staffs/{$staff->id}", [
            'store_location_ids' => [$first->id, $second->id],
        ])->assertSuccessful();
        $this->assertSameCanonicalizing(
            [$first->id, $second->id],
            $user->storeLocations()->pluck('store_locations.id')->all(),
        );
    }

    public function test_assignment_sync_is_additive_multi_branch_and_idempotent(): void
    {
        $staff = $this->staff();
        $user = User::factory()->create(['staff_id' => $staff->id]);
        $assignedA = $this->branch('A');
        $assignedB = $this->branch('B');
        $manual = $this->branch('MANUAL');
        $staff->storeLocations()->sync([$assignedA->id, $assignedB->id]);
        $user->storeLocations()->attach($manual);

        $service = app(StaffBranchAccessService::class);
        $service->synchronize($staff, $user);
        $service->synchronize($staff, $user);

        $this->assertSameCanonicalizing(
            [$assignedA->id, $assignedB->id, $manual->id],
            $user->storeLocations()->pluck('store_locations.id')->all(),
        );
        $this->assertSame(3, DB::table('store_location_user')->where('user_id', $user->id)->count());

        $staff->storeLocations()->sync([$assignedB->id]);
        $service->synchronize($staff, $user);
        $this->assertTrue($user->storeLocations()->whereKey($assignedA->id)->exists(), 'Existing access is preserved because its source is not recorded.');
        $this->assertTrue($user->storeLocations()->whereKey($manual->id)->exists());
    }

    public function test_linking_user_after_work_at_assignment_synchronizes_access(): void
    {
        $staff = $this->staff();
        $branch = $this->branch('LINK');
        $staff->storeLocations()->attach($branch);

        $user = User::factory()->create(['staff_id' => $staff->id]);

        $this->assertDatabaseHas('store_location_user', ['user_id' => $user->id, 'store_location_id' => $branch->id]);
    }

    public function test_current_staff_user_api_returns_only_active_authorized_branches(): void
    {
        $staff = $this->staff();
        $active = $this->branch('ACTIVE', true);
        $inactive = $this->branch('INACTIVE', false);
        $unrelated = $this->branch('OTHER', true);
        $staff->storeLocations()->sync([$active->id, $inactive->id]);
        $user = User::factory()->create(['staff_id' => $staff->id]);

        $this->actingAs($user)->getJson('/api/me/store-locations')->assertOk()
            ->assertJsonFragment(['id' => $active->id, 'is_active' => true])
            ->assertJsonFragment(['id' => $inactive->id, 'is_active' => false])
            ->assertJsonMissing(['id' => $unrelated->id]);

        // The API preserves status; the existing BranchContext filters inactive options.
        $this->assertSame([$active->id], app(\App\Services\StoreLocationAccessService::class)
            ->accessibleStoreLocations($user, false)->pluck('id')->all());
    }

    public function test_reconciliation_dry_run_writes_nothing_and_force_adds_only_missing_access(): void
    {
        $staff = $this->staff();
        $branch = $this->branch('REC');
        $staff->storeLocations()->attach($branch);
        $user = User::factory()->create();
        DB::table('users')->where('id', $user->id)->update(['staff_id' => $staff->id]); // create an intentionally inconsistent legacy row

        $this->artisan('staff-branch-access:reconcile --dry-run')
            ->expectsOutput('Dry run: zero rows written. Use --force to add missing access.')
            ->assertSuccessful();
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $user->id, 'store_location_id' => $branch->id]);

        $this->artisan('staff-branch-access:reconcile --force')->expectsOutput('Added 1 missing access row(s).')->assertSuccessful();
        $this->assertDatabaseHas('store_location_user', ['user_id' => $user->id, 'store_location_id' => $branch->id]);
    }

    public function test_platform_bypass_remains_unchanged(): void
    {
        $platformRole = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        $platform = User::factory()->create();
        $platform->roles()->attach($platformRole);
        $branch = $this->branch('GLOBAL');

        $this->actingAs($platform)->getJson('/api/me/store-locations')->assertOk()->assertJsonFragment(['id' => $branch->id]);
        $this->assertDatabaseMissing('store_location_user', ['user_id' => $platform->id]);
    }

    private function staff(): Staff
    {
        return Staff::create(['name' => 'Staff '.uniqid(), 'email' => uniqid().'@example.test', 'is_active' => true]);
    }

    private function branch(string $code, bool $active = true): StoreLocation
    {
        return StoreLocation::create([
            'name' => $code.' Branch', 'code' => $code, 'address_line1' => 'Address', 'city' => 'City',
            'state' => 'State', 'postcode' => '10000', 'country' => 'Malaysia', 'is_active' => $active,
        ]);
    }
}
