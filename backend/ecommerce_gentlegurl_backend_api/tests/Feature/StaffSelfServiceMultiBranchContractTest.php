<?php

namespace Tests\Feature;

use Tests\TestCase;

class StaffSelfServiceMultiBranchContractTest extends TestCase
{
    public function test_my_leave_history_is_backend_scoped_and_renders_persisted_branch_metadata(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Booking/MyLeaveController.php'));
        $component = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/booking/BookingMyLeavePage.tsx'));

        $this->assertStringContainsString("'branch_store_location_id'", $controller);
        $this->assertStringContainsString('accessibleStoreLocations($request->user(), false)', $controller);
        $this->assertStringContainsString("'storeLocation:id,name'", $controller);
        $this->assertStringContainsString("->where('store_location_id', \$selectedBranchId)", $controller);
        $this->assertStringContainsString("->orWhereNull('store_location_id')", $controller);
        $this->assertStringContainsString("qs.set('branch_store_location_id'", $component);
        $this->assertStringContainsString("row.store_location?.name ?? (row.store_location_id ? 'Unknown Branch' : 'Unassigned')", $component);
        $this->assertStringContainsString('8 + (isAllBranches ? 1 : 0)', $component);
    }

    public function test_consumable_history_uses_order_branch_with_backend_authorization_and_eager_loading(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Ecommerce/PosController.php'));
        $component = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/StaffConsumableHistoryPageContent.tsx'));

        $methodStart = strpos($controller, 'public function myStaffConsumableClaims');
        $methodEnd = strpos($controller, 'public function adminStaffConsumableLogs', $methodStart);
        $method = substr($controller, $methodStart, $methodEnd - $methodStart);

        $this->assertStringContainsString('accessibleStoreLocations($request->user(), false)', $method);
        $this->assertStringContainsString('authorizeStoreLocation($request->user()', $method);
        $this->assertStringContainsString("->where('store_location_id', \$selectedBranchId)", $method);
        $this->assertStringContainsString("->orWhereNull('store_location_id')", $method);
        $this->assertStringContainsString("'order.storeLocation:id,name,code'", $controller);
        $this->assertStringContainsString("'store_location_id' => \$order?->store_location_id", $controller);
        $this->assertStringContainsString("params.set('branch_store_location_id'", $component);
        $this->assertStringContainsString('4 + (isAllBranches ? 1 : 0)', $component);
    }
}
