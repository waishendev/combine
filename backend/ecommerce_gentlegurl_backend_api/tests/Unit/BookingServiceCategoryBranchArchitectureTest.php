<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class BookingServiceCategoryBranchArchitectureTest extends TestCase
{
    public function test_all_booking_surfaces_send_a_concrete_branch_for_categories(): void
    {
        $pos = $this->read('../../../../frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');
        $appointments = $this->read('../../../../frontend/ecommerce_gentlegurl_crm/src/components/pos/PosAppointmentsWorkspace.tsx');
        $shop = $this->read('../../../../frontend/booking_gentlegurl_shop/src/app/booking/BookingPageContent.tsx');
        $api = $this->read('../../../../frontend/booking_gentlegurl_shop/src/lib/apiClient.ts');

        $this->assertStringContainsString('service-categories?${params}', $pos);
        $this->assertStringContainsString('if (!selectedBranchId)', $pos);
        $this->assertStringContainsString("appointmentBranchScopedUrl('/api/proxy/booking/service-categories', branchId)", $appointments);
        $this->assertStringContainsString('if (!branchId)', $appointments);
        $this->assertStringContainsString('getBookingServiceCategories(selectedStoreLocation.id)', $shop);
        $this->assertStringContainsString('service-categories?store_location_id=${storeLocationId}', $api);
    }

    public function test_category_visibility_is_derived_without_a_category_branch_pivot(): void
    {
        $model = $this->read('../../app/Models/Booking/BookingServiceCategory.php');
        $migrations = glob(__DIR__.'/../../database/migrations/*.php') ?: [];
        $migrationSource = implode("\n", array_map(fn (string $path) => (string) file_get_contents($path), $migrations));

        $this->assertStringContainsString('scopeVisibleAtBranch', $model);
        $this->assertStringContainsString("whereHas('services'", $model);
        $this->assertStringNotContainsString('booking_service_category_store_location', $migrationSource);
    }

    private function read(string $path): string
    {
        return (string) file_get_contents(__DIR__.'/'.$path);
    }
}
