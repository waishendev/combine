<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PosCatalogueBranchScopeArchitectureTest extends TestCase
{
    public function test_operational_catalogues_authorize_and_filter_the_explicit_branch(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');

        $this->assertStringContainsString('public function productCatalog', $source);
        $this->assertStringContainsString("where('store_location_product.is_available', true)", $source);
        $this->assertStringContainsString("'branchInventories' => fn", $source);
        $this->assertStringContainsString('public function bookingProductSearch', $source);
        $this->assertStringContainsString("whereHas('linkedBookingService.storeLocations'", $source);
        $this->assertStringContainsString("whereHas('storeLocations', fn", $source);
        $this->assertGreaterThanOrEqual(3, substr_count($source, "authorizeStoreLocation(\n            \$request->user(), \$request->integer('store_location_id'), false"));
        $this->assertStringContainsString("\$query->where('store_location_id', \$branch->id)", $source);
    }

    public function test_frontend_keys_requests_and_invalidation_are_branch_aware_and_lazy(): void
    {
        $source = file_get_contents(__DIR__.'/../../../../frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');

        $this->assertStringContainsString('booking-services:${selectedBranchId}', $source);
        $this->assertStringContainsString('booking-products:${selectedBranchId}', $source);
        $this->assertStringContainsString('settlement:${selectedBranchId}', $source);
        $this->assertStringContainsString("params.set('store_location_id', String(selectedBranchId))", $source);
        $this->assertStringContainsString('Object.values(lazyRequestAbortRef.current).forEach((controller) => controller.abort())', $source);
        $this->assertStringContainsString("if (catalogTab === 'book-service')", $source);
        $this->assertStringContainsString("'data' in payload && Array.isArray", $source);
        $this->assertStringNotContainsString('window.setTimeout(tick, 60_000)', $source);
    }


    public function test_booking_management_lists_use_authorized_branch_scope_and_metadata(): void
    {
        foreach (['ServiceController.php', 'BookingProductController.php', 'CategoryController.php', 'BookingProductCategoryController.php'] as $controller) {
            $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Admin/Booking/'.$controller);
            $this->assertStringContainsString('accessibleStoreLocations', $source);
            $this->assertStringContainsString('authorizeStoreLocation', $source);
            $this->assertStringContainsString('store_location_id', $source);
        }

        foreach (['BookingServicesTable.tsx', 'BookingProductsTable.tsx', 'BookingServiceCategoriesTable.tsx', 'BookingProductCategoriesTable.tsx'] as $component) {
            $frontend = file_get_contents(__DIR__.'/../../../../frontend/ecommerce_gentlegurl_crm/src/components/booking/'.$component);
            $this->assertStringContainsString("qs.set('branch_scope', 'all')", $frontend);
            $this->assertStringContainsString("qs.set('branch_store_location_id', String(selectedBranchId))", $frontend);
            $this->assertStringContainsString('isAllBranches && <th', $frontend);
        }
    }
}
