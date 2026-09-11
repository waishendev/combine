<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class BookingMultiBranchAvailabilityContractTest extends TestCase
{
    public function test_booking_products_have_independent_branch_storage_and_linked_sync(): void
    {
        $migration = $this->backend('database/migrations/2027_01_07_000002_add_booking_product_and_service_staff_branch_availability.php');
        $controller = $this->backend('app/Http/Controllers/Admin/Booking/BookingProductController.php');
        $linker = $this->backend('app/Services/Booking/BookingServiceProductLinkService.php');
        $pos = $this->backend('app/Http/Controllers/Ecommerce/PosController.php');

        $this->assertStringContainsString("Schema::create('booking_product_store_location'", $migration);
        $this->assertStringContainsString('assertCanAssign($request->user()', $controller);
        $this->assertStringContainsString('Branch availability is managed by the linked Booking Service.', $controller);
        $this->assertStringContainsString('$product->storeLocations()->sync(', $linker);
        $this->assertStringContainsString("whereDoesntHave('linkedBookingService')", $pos);
        $this->assertStringContainsString("whereHas('storeLocations'", $pos);
    }

    public function test_service_staff_assignments_are_branch_specific_and_slots_intersect_staff_branch(): void
    {
        $migration = $this->backend('database/migrations/2027_01_07_000002_add_booking_product_and_service_staff_branch_availability.php');
        $controller = $this->backend('app/Http/Controllers/Admin/Booking/ServiceController.php');
        $availability = $this->backend('app/Http/Controllers/Booking/AvailabilityController.php');

        $this->assertStringContainsString("foreignId('store_location_id')->nullable()", $migration);
        $this->assertStringContainsString('booking_service_branch_staff_unique', $migration);
        $this->assertStringContainsString('resolveAllowedStaffByLocation', $controller);
        $this->assertStringContainsString("whereHas('storeLocations'", $controller);
        $this->assertStringContainsString('syncAllowedStaffsByLocation', $controller);
        $this->assertStringContainsString('allowedStaffsAt((int) $validated[\'store_location_id\'])', $availability);
    }

    public function test_crm_renders_branch_products_and_per_branch_staff_cards(): void
    {
        $product = $this->frontend('BookingProductUpsertModal.tsx');
        $create = $this->frontend('BookingServiceCreateModal.tsx');
        $edit = $this->frontend('BookingServiceEditModal.tsx');

        $this->assertStringContainsString('BranchAssignmentChecklist', $product);
        $this->assertStringContainsString('Managed by Booking Service', $product);
        $this->assertStringContainsString('allowed_staff_by_store_location', $create);
        $this->assertStringContainsString('staff.store_location_ids?.includes(locationId)', $create);
        $this->assertStringContainsString('allowed_staff_by_store_location', $edit);
        $this->assertStringContainsString('staff.store_location_ids?.includes(locationId)', $edit);
    }

    private function backend(string $path): string
    {
        return (string) file_get_contents(dirname(__DIR__, 2).'/'.$path);
    }

    private function frontend(string $file): string
    {
        return (string) file_get_contents(dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/components/booking/'.$file);
    }
}
