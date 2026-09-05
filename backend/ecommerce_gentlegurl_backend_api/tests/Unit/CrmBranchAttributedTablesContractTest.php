<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class CrmBranchAttributedTablesContractTest extends TestCase
{
    public function test_branch_attributed_tables_use_persisted_sources_and_conditional_columns(): void
    {
        $commission = $this->frontend('commissions/CommissionLogsPage.tsx');
        $consumables = $this->frontend('StaffConsumableLogsPageContent.tsx');
        $movements = $this->frontend('ProductStockMovementLogsPage.tsx');
        $bookingLogs = $this->frontend('booking/BookingLogsPage.tsx');

        foreach ([$commission, $consumables, $movements, $bookingLogs] as $table) {
            $this->assertStringContainsString('shouldShowBranchColumn(selectedBranchId)', $table);
            $this->assertStringContainsString('branchName(row)', $table);
        }

        $this->assertStringContainsString("qs.set('branch_store_location_id', String(selectedBranchId))", $commission);
        $this->assertStringContainsString("params.set('store_location_id', String(selectedBranchId))", $consumables);
        $this->assertStringContainsString("params.set('store_location_id', String(selectedBranchId))", $movements);
        $this->assertStringContainsString("qs.set('branch_store_location_id', String(selectedBranchId))", $bookingLogs);
    }

    public function test_backend_sources_are_earning_order_ledger_and_booking(): void
    {
        $commission = $this->backend('Http/Controllers/Admin/Booking/CommissionLogController.php');
        $pos = $this->backend('Http/Controllers/Ecommerce/PosController.php');
        $movements = $this->backend('Http/Controllers/Ecommerce/ProductStockMovementController.php');
        $bookingLogs = $this->backend('Http/Controllers/Admin/Booking/LogController.php');

        $this->assertStringContainsString('StaffCommissionLog::query()', $commission);
        $this->assertStringContainsString("'order.storeLocation:id,name,code'", $pos);
        $this->assertStringContainsString("ProductStockMovement::query(), 'product_stock_movements.store_location_id'", $movements);
        $this->assertStringContainsString("whereHas('booking'", $bookingLogs);
        $this->assertStringContainsString('ExpenseBranchScope::fromRequest', $bookingLogs);
    }

    public function test_leave_tables_remain_global_per_staff(): void
    {
        foreach (['BookingLeaveRequestsPage.tsx', 'BookingLeaveBalancesPage.tsx', 'BookingLeaveLogsPage.tsx'] as $file) {
            $source = $this->frontend('booking/'.$file);
            $this->assertStringNotContainsString('Branch</th>', $source);
            $this->assertStringNotContainsString('branch_store_location_id', $source);
        }
    }

    private function frontend(string $file): string
    {
        return (string) file_get_contents(dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/components/'.$file);
    }

    private function backend(string $file): string
    {
        return (string) file_get_contents(dirname(__DIR__, 2).'/app/'.$file);
    }
}
