<?php

namespace Tests\Feature;

use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Models\User;
use App\Services\Booking\StaffCommissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class Phase9EBranchCommissionCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_threshold_is_independent_and_each_snapshot_uses_its_branch_tier(): void
    {
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        StaffCommissionTier::create(['store_location_id' => $a->id, 'type' => 'ECOMMERCE', 'min_sales' => 0, 'commission_percent' => 5]);
        StaffCommissionTier::create(['store_location_id' => $b->id, 'type' => 'ECOMMERCE', 'min_sales' => 0, 'commission_percent' => 3]);
        $staffId = $this->staffId();
        $rowA = StaffMonthlySale::create($this->snapshot($staffId, $a->id, 3000));
        $rowB = StaffMonthlySale::create($this->snapshot($staffId, $b->id, 4000));

        $service = app(StaffCommissionService::class);
        $this->assertSame('150.00', $service->recalculateMonthly($rowA)->commission_amount);
        $this->assertSame('120.00', $service->recalculateMonthly($rowB)->commission_amount);
        $this->assertDatabaseCount('staff_monthly_sales', 2);
    }

    public function test_branch_snapshot_without_branch_tier_fails_explicitly(): void
    {
        $this->expectException(\RuntimeException::class);
        app(StaffCommissionService::class)->recalculateMonthly(StaffMonthlySale::create($this->snapshot($this->staffId(), $this->branch('A')->id, 100)));
    }

    public function test_role_reconciliation_moves_only_operational_role_and_is_idempotent(): void
    {
        $png = $this->branch('PNG');
        $user = User::create(['name' => 'PNG Admin', 'email' => 'png@example.test', 'password' => 'password', 'is_active' => true]);
        $user->storeLocations()->attach($png->id);
        $operational = Role::create(['name' => 'Manager', 'is_active' => true, 'is_system' => false]);
        $system = Role::create(['name' => 'infra_core_x1', 'is_active' => true, 'is_system' => true]);
        $user->roles()->attach([$operational->id, $system->id]);

        $this->assertSame(0, Artisan::call('role-branch:reconcile', ['--store-code' => 'PNG', '--force' => true]));
        $this->assertDatabaseHas('roles', ['id' => $operational->id, 'store_location_id' => $png->id]);
        $this->assertDatabaseHas('roles', ['id' => $system->id, 'store_location_id' => null]);
        $this->assertDatabaseHas('role_user_store_location', ['user_id' => $user->id, 'role_id' => $operational->id, 'store_location_id' => $png->id]);
        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $system->id]);
        $this->assertSame(0, Artisan::call('role-branch:reconcile', ['--store-code' => 'PNG', '--force' => true]));
        $this->assertDatabaseCount('role_user_store_location', 1);
    }

    public function test_role_reconciliation_does_not_assign_user_without_target_access(): void
    {
        $this->branch('PNG');
        $user = User::create(['name' => 'Other', 'email' => 'other@example.test', 'password' => 'password', 'is_active' => true]);
        $role = Role::create(['name' => 'Cashier', 'is_active' => true, 'is_system' => false]);
        $user->roles()->attach($role);
        Artisan::call('role-branch:reconcile', ['--store-code' => 'PNG', '--force' => true]);
        $this->assertDatabaseHas('roles', ['id' => $role->id, 'store_location_id' => null]);
        $this->assertDatabaseMissing('role_user_store_location', ['user_id' => $user->id, 'role_id' => $role->id]);
    }

    public function test_commission_reconcile_dry_run_makes_no_changes(): void
    {
        $this->branch('PNG');
        StaffCommissionTier::create(['store_location_id' => null, 'type' => 'ECOMMERCE', 'min_sales' => 0, 'commission_percent' => 5]);
        Artisan::call('commission-branch:reconcile', ['--store-code' => 'PNG', '--dry-run' => true]);
        $this->assertDatabaseHas('staff_commission_tiers', ['store_location_id' => null, 'type' => 'ECOMMERCE']);
        $this->assertStringContainsString('DRY RUN ONLY', Artisan::output());
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['code' => $code, 'name' => "Branch {$code}", 'address' => 'Test', 'is_active' => true]);
    }

    private function staffId(): int
    {
        return (int) \DB::table('staffs')->insertGetId(['name' => 'Staff', 'email' => uniqid().'@example.test', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function snapshot(int $staffId, int $branchId, float $sales): array
    {
        return ['store_location_id' => $branchId, 'type' => 'ECOMMERCE', 'staff_id' => $staffId, 'year' => 2026, 'month' => 8,
            'total_sales' => $sales, 'booking_count' => 1, 'tier_percent' => 0, 'commission_amount' => 0, 'is_overridden' => false, 'status' => 'OPEN'];
    }
}
