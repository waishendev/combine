<?php

namespace Tests\Feature;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RoleBranchMutationUxTest extends TestCase
{
    use RefreshDatabase;

    private User $actor;
    private StoreLocation $branchA;
    private StoreLocation $branchB;

    protected function setUp(): void
    {
        parent::setUp();

        $platform = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        foreach (['roles.view', 'roles.create', 'roles.delete'] as $slug) {
            $platform->permissions()->attach(Permission::create(['name' => $slug, 'slug' => $slug]));
        }
        $this->actor = $this->user('actor@example.com');
        $this->actor->roles()->attach($platform);
        $this->branchA = $this->location('A');
        $this->branchB = $this->location('B');
    }

    public function test_all_scope_create_persists_each_selected_branch_and_returns_metadata(): void
    {
        foreach ([[$this->branchA, 'Receptionist'], [$this->branchB, 'Manager']] as [$branch, $name]) {
            $response = $this->actingAs($this->actor)->postJson('/api/roles/query', [
                'name' => $name,
                'store_location_id' => $branch->id,
                'permissions' => [],
            ]);

            $response->assertOk()
                ->assertJsonPath('data.store_location_id', $branch->id)
                ->assertJsonPath('data.store_location.id', $branch->id)
                ->assertJsonPath('data.store_location.name', $branch->name);
            $this->assertDatabaseHas('roles', ['name' => $name, 'store_location_id' => $branch->id]);
        }
    }

    public function test_create_requires_a_concrete_accessible_branch(): void
    {
        $limited = $this->user('limited@example.com');
        $permissionRole = Role::create(['name' => 'limited-admin', 'is_active' => true, 'is_system' => false]);
        foreach (['roles.view', 'roles.create'] as $slug) {
            $permissionRole->permissions()->attach(Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]));
        }
        $limited->roles()->attach($permissionRole);
        $limited->storeLocations()->attach($this->branchA);

        $this->actingAs($limited)->postJson('/api/roles/query', ['name' => 'Missing Branch'])
            ->assertStatus(422)->assertJsonPath('message', 'A Branch is required when creating a Role from All Branches.');
        $this->actingAs($limited)->postJson('/api/roles/query', ['name' => 'Wrong Branch', 'store_location_id' => $this->branchB->id])
            ->assertForbidden()->assertJsonPath('message', 'You are not allowed to access the selected branch.');
    }

    public function test_protected_and_assigned_roles_return_business_delete_messages(): void
    {
        $protected = Role::create(['name' => 'Staff', 'store_location_id' => $this->branchA->id, 'is_active' => true, 'is_system' => true]);
        $assigned = Role::create(['name' => 'Assigned', 'store_location_id' => $this->branchA->id, 'is_active' => true, 'is_system' => false]);
        $assignedUser = $this->user('assigned@example.com');
        $assignedUser->branchRoles()->attach($assigned->id, ['store_location_id' => $this->branchA->id]);

        $this->actingAs($this->actor)->deleteJson("/api/roles/{$protected->id}/query")
            ->assertStatus(409)->assertJsonPath('message', 'This protected system Role cannot be deleted.');
        $this->actingAs($this->actor)->deleteJson("/api/roles/{$assigned->id}/query")
            ->assertStatus(409)->assertJsonPath('message', 'This Role cannot be deleted because it is still assigned to 1 user.');
        $this->assertDatabaseHas('roles', ['id' => $protected->id]);
        $this->assertDatabaseHas('roles', ['id' => $assigned->id]);
    }

    public function test_inaccessible_delete_is_rejected_and_unassigned_role_deletes(): void
    {
        $limited = $this->user('delete-limited@example.com');
        $permissionRole = Role::create(['name' => 'delete-admin', 'is_active' => true, 'is_system' => false]);
        $permissionRole->permissions()->attach(Permission::firstOrCreate(['slug' => 'roles.delete'], ['name' => 'roles.delete']));
        $limited->roles()->attach($permissionRole);
        $limited->storeLocations()->attach($this->branchA);
        $hidden = Role::create(['name' => 'Hidden', 'store_location_id' => $this->branchB->id, 'is_active' => true, 'is_system' => false]);
        $deletable = Role::create(['name' => 'Temporary', 'store_location_id' => $this->branchA->id, 'is_active' => true, 'is_system' => false]);

        $this->actingAs($limited)->deleteJson("/api/roles/{$hidden->id}/query")
            ->assertForbidden()->assertJsonPath('message', 'You are not allowed to access the selected branch.');
        $this->actingAs($limited)->deleteJson("/api/roles/{$deletable->id}/query")->assertOk();
        $this->assertDatabaseMissing('roles', ['id' => $deletable->id]);
    }

    public function test_delete_without_permission_returns_a_role_specific_business_message(): void
    {
        $unprivileged = $this->user('unprivileged@example.com');
        $unprivileged->storeLocations()->attach($this->branchA);
        $role = Role::create(['name' => 'No Permission Target', 'store_location_id' => $this->branchA->id, 'is_active' => true, 'is_system' => false]);

        $this->actingAs($unprivileged)->deleteJson("/api/roles/{$role->id}/query")
            ->assertForbidden()
            ->assertJsonPath('message', 'You do not have permission to delete Roles for this Branch.');
        $this->assertDatabaseHas('roles', ['id' => $role->id]);
    }

    private function user(string $email): User
    {
        return User::create(['name' => $email, 'email' => $email, 'password' => Hash::make('password'), 'is_active' => true]);
    }

    private function location(string $code): StoreLocation
    {
        return StoreLocation::create([
            'name' => "Branch {$code}", 'code' => $code, 'address_line1' => 'Address', 'city' => 'City',
            'state' => 'State', 'postcode' => '10000', 'country' => 'Malaysia', 'is_active' => true,
            'is_pickup_available' => true, 'is_booking_available' => true, 'is_pos_available' => true,
        ]);
    }
}
