<?php

namespace Tests\Feature;

use App\Console\Commands\CleanupLegacyGlobalRolesCommand;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CleanupLegacyGlobalRolesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_preserves_platform_and_performs_zero_writes(): void
    {
        $branch = $this->branch('PNG'); $permission = $this->permission('pos.checkout');
        $platform = $this->role('infra_core_x1', null, true, [$permission->id]);
        $legacy = $this->role('Staff', null, true, [$permission->id]);
        $copy = $this->role('Staff', $branch, true, [$permission->id]); $before = $this->snapshot();

        $this->assertSame(0, Artisan::call('role-branch:cleanup-legacy-global', ['--dry-run' => true]));
        $this->assertStringContainsString("infra_core_x1 [id={$platform->id}]", Artisan::output());
        $this->assertStringContainsString('status: SAFE TO CLEAN', Artisan::output());
        $this->assertStringContainsString('DRY RUN ONLY — NO DATA CHANGED', Artisan::output());
        $this->assertSame($before, $this->snapshot());
        $this->assertDatabaseHas('roles', ['id' => $legacy->id]); $this->assertDatabaseHas('roles', ['id' => $copy->id]);
    }

    public function test_force_cleans_protected_builtins_without_changing_access_copies_or_platform_role(): void
    {
        $png = $this->branch('PNG'); $other = $this->branch('OTHER'); $permission = $this->permission('roles.view');
        $platform = $this->role('infra_core_x1', null, true, [$permission->id]);
        $legacyStaff = $this->role('Staff', null, true, [$permission->id]);
        $legacySuper = $this->role('superAdmin', null, true, [$permission->id]); $copies = collect();
        foreach ([$png, $other] as $branch) {
            $copies->push($this->role('Staff', $branch, true, [$permission->id]));
            $copies->push($this->role('superAdmin', $branch, true, [$permission->id]));
        }
        $user = $this->user('resolved@example.test', [$png->id, $other->id]);
        $user->roles()->attach([$legacyStaff->id, $legacySuper->id]); foreach ($copies as $copy) $this->assign($user, $copy);
        $access = DB::table('store_location_user')->orderBy('store_location_id')->get()->toArray();
        $assignments = DB::table('role_user_store_location')->orderBy('role_id')->get()->toArray();
        $permissions = DB::table('permission_role')->whereIn('role_id', $copies->pluck('id'))->orderBy('role_id')->get()->toArray();

        $this->assertSame(0, $this->force());
        $this->assertDatabaseHas('roles', ['id' => $platform->id, 'store_location_id' => null]);
        $this->assertDatabaseMissing('roles', ['id' => $legacyStaff->id]); $this->assertDatabaseMissing('roles', ['id' => $legacySuper->id]);
        $this->assertEquals($access, DB::table('store_location_user')->orderBy('store_location_id')->get()->toArray());
        $this->assertEquals($assignments, DB::table('role_user_store_location')->orderBy('role_id')->get()->toArray());
        $this->assertEquals($permissions, DB::table('permission_role')->whereIn('role_id', $copies->pluck('id'))->orderBy('role_id')->get()->toArray());
        $this->assertSame(0, $this->force()); $this->assertSame(1, Role::whereNull('store_location_id')->count());
    }

    public function test_is_system_alone_does_not_imply_platform_global(): void
    {
        config(['multi_branch.legacy_operational_role_names' => ['Protected Operations']]);
        $branch = $this->branch('PNG'); $legacy = $this->role('Protected Operations', null, true);
        $this->role('Protected Operations', $branch, true);
        $this->assertSame(0, $this->force()); $this->assertDatabaseMissing('roles', ['id' => $legacy->id]);
    }

    public function test_missing_copy_permission_conflict_and_ambiguous_custom_role_are_preserved(): void
    {
        $png = $this->branch('PNG'); $this->branch('OTHER');
        $baseline = $this->permission('baseline.view'); $different = $this->permission('different.view');
        $missing = $this->role('Admin', null, false, [$baseline->id]); $this->role('Admin', $png, false, [$baseline->id]);
        $conflict = $this->role('Staff', null, true, [$baseline->id]); $this->role('Staff', $png, true, [$different->id]);
        $ambiguous = $this->role('Unclassified Custom', null, false, [$baseline->id]);
        $this->assertSame(0, $this->force());
        foreach ([$missing, $conflict, $ambiguous] as $role) $this->assertDatabaseHas('roles', ['id' => $role->id]);
        $this->assertStringContainsString('missing required Branch copies', Artisan::output());
        $this->assertStringContainsString('permission conflict', Artisan::output());
        $this->assertStringContainsString('Ambiguous NULL Roles preserved', Artisan::output());
    }

    public function test_global_assignment_blocks_cleanup_until_every_authoritative_assignment_exists(): void
    {
        $png = $this->branch('PNG'); $other = $this->branch('OTHER'); $legacy = $this->role('Staff', null, true);
        $pngCopy = $this->role('Staff', $png, true); $otherCopy = $this->role('Staff', $other, true);
        $user = $this->user('incomplete@example.test', [$png->id, $other->id]); $user->roles()->attach($legacy); $this->assign($user, $pngCopy);
        $this->assertSame(0, $this->force()); $this->assertDatabaseHas('roles', ['id' => $legacy->id]);
        $this->assertStringContainsString('unresolved global role_user assignments', Artisan::output());
        $this->assign($user, $otherCopy); $this->assertSame(0, $this->force());
        $this->assertDatabaseMissing('roles', ['id' => $legacy->id]);
        $this->assertDatabaseHas('role_user_store_location', ['role_id' => $pngCopy->id, 'user_id' => $user->id]);
        $this->assertDatabaseHas('role_user_store_location', ['role_id' => $otherCopy->id, 'user_id' => $user->id]);
    }

    public function test_force_requires_exact_confirmation_token(): void
    {
        $this->assertSame(1, Artisan::call('role-branch:cleanup-legacy-global', ['--force' => true]));
        $this->assertSame(1, Artisan::call('role-branch:cleanup-legacy-global', ['--force' => true, '--confirm' => 'wrong']));
    }

    private function force(): int { return Artisan::call('role-branch:cleanup-legacy-global', ['--force' => true, '--confirm' => CleanupLegacyGlobalRolesCommand::CONFIRMATION]); }
    private function branch(string $code): StoreLocation { return StoreLocation::create(['code' => $code, 'name' => "Branch {$code}", 'address' => 'Test', 'is_active' => true]); }
    private function permission(string $slug): Permission { return Permission::create(['name' => $slug, 'slug' => $slug]); }
    private function role(string $name, ?StoreLocation $branch, bool $system = false, array $permissions = []): Role
    {
        $role = Role::create(['name' => $name, 'store_location_id' => $branch?->id, 'is_active' => true, 'is_system' => $system]);
        $role->permissions()->sync($permissions); return $role;
    }
    private function user(string $email, array $branchIds): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'password', 'is_active' => true]);
        $user->storeLocations()->attach($branchIds); return $user;
    }
    private function assign(User $user, Role $role): void
    {
        DB::table('role_user_store_location')->insert(['user_id' => $user->id, 'store_location_id' => $role->store_location_id,
            'role_id' => $role->id, 'created_at' => now(), 'updated_at' => now()]);
    }
    private function snapshot(): array
    {
        return ['roles' => DB::table('roles')->orderBy('id')->get()->toArray(), 'role_user' => DB::table('role_user')->orderBy('role_id')->get()->toArray(),
            'branch_roles' => DB::table('role_user_store_location')->orderBy('role_id')->get()->toArray(),
            'access' => DB::table('store_location_user')->orderBy('user_id')->get()->toArray(),
            'permissions' => DB::table('permission_role')->orderBy('role_id')->get()->toArray()];
    }
}
