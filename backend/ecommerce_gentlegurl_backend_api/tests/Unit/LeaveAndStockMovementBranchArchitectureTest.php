<?php

namespace Tests\Unit;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class LeaveAndStockMovementBranchArchitectureTest extends TestCase
{
    #[Test]
    public function legacy_commands_only_update_null_attribution_and_require_explicit_modes(): void
    {
        $stock = file_get_contents(app_path('Console/Commands/BackfillStockMovementBranchesCommand.php'));
        $leave = file_get_contents(app_path('Console/Commands/BackfillLeaveBranchesCommand.php'));
        $this->assertStringContainsString("whereNull('store_location_id')", $stock);
        $this->assertStringContainsString("whereNull('store_location_id')", $leave);
        $this->assertStringContainsString("option('dry-run') === (bool) \$this->option('force')", $stock);
        $this->assertStringNotContainsString("whereNotNull('store_location_id')->update", $stock);
    }

    #[Test]
    public function leave_balance_stays_global_while_operational_writers_copy_branch(): void
    {
        $migration = file_get_contents(database_path('migrations/2027_03_05_000001_add_branch_to_booking_leave_requests.php'));
        $leaveMigration = file_get_contents(database_path('migrations/2026_04_07_000010_create_booking_leave_management_tables.php'));
        $service = file_get_contents(app_path('Services/Booking/BookingLeaveService.php'));
        $this->assertStringContainsString("Schema::table('booking_leave_requests'", $migration);
        $this->assertStringNotContainsString("store_location_id", explode("Schema::create('booking_leave_requests'", $leaveMigration)[0]);
        $this->assertStringContainsString("'store_location_id' => \$source->store_location_id", $service);
        $this->assertStringContainsString("'store_location_id' => \$item->store_location_id", $service);
    }

    #[Test]
    public function all_scope_is_access_controlled_and_ambiguous_creation_is_rejected(): void
    {
        $service = file_get_contents(app_path('Services/Booking/LeaveBranchService.php'));
        $this->assertStringContainsString('accessibleStoreLocations', $service);
        $this->assertStringContainsString('works at more than one accessible Branch', $service);
        $this->assertStringContainsString("orWhereNull('store_location_id')", $service);
        $this->assertStringNotContainsString("PNG", $service);
    }

    #[Test]
    public function leave_balance_view_is_assignment_scoped_bulk_loaded_and_not_branch_owned(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Admin/Booking/LeaveBalanceController.php'));
        $migration = file_get_contents(database_path('migrations/2026_04_07_000010_create_booking_leave_management_tables.php'));
        $this->assertStringContainsString('accessibleStoreLocations', $controller);
        $this->assertStringContainsString("whereHas('storeLocations'", $controller);
        $this->assertStringContainsString("with(['storeLocations'", $controller);
        $this->assertStringContainsString("whereIn('staff_id', \$staffIds)", $controller);
        $this->assertStringNotContainsString('store_location_id', explode("Schema::create('booking_leave_requests'", $migration)[0]);
    }

    #[Test]
    public function all_creation_ui_resolves_a_concrete_eligible_branch_before_submit(): void
    {
        $calendar = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/booking/BookingLeaveCalendarPage.tsx'));
        $myLeave = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/booking/BookingMyLeavePage.tsx'));
        $balances = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/booking/BookingLeaveBalancesPage.tsx'));
        $this->assertStringContainsString('AllBranchesCreationField', $calendar);
        $this->assertStringContainsString('concreteBranchId', $calendar);
        $this->assertStringContainsString('store_location_id: branchId', $calendar);
        $this->assertStringContainsString('eligible-branches', $myLeave);
        $this->assertStringContainsString('Assigned Branches', $balances);
        $this->assertStringContainsString('isAllBranches', $balances);
    }
}
