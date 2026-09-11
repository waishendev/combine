<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PosCategoryVisibilityArchitectureTest extends TestCase
{
    public function test_pos_catalogues_and_categories_share_model_eligibility_scopes(): void
    {
        $pos = $this->read('../../app/Http/Controllers/Ecommerce/PosController.php');
        $categories = $this->read('../../app/Http/Controllers/CategoryController.php');
        $bookingCategories = $this->read('../../app/Http/Controllers/Admin/Booking/BookingProductCategoryController.php');

        $this->assertStringContainsString('posEligibleAtBranch((int) $branch->id)', $pos);
        $this->assertGreaterThanOrEqual(2, substr_count($pos, 'posEligibleAtBranch((int) $branch->id)'));
        $this->assertStringContainsString("whereHas('products', fn (\$products) => \$products->posEligibleAtBranch(\$branchId))", $categories);
        $this->assertStringContainsString('visibleAtPosBranch($branchId)', $bookingCategories);
        $this->assertStringContainsString("withCount(['products as products_count'", $bookingCategories);
    }

    public function test_frontend_keeps_booking_categories_lazy_and_invalidates_both_selections_on_branch_change(): void
    {
        $frontend = $this->read('../../../../frontend/ecommerce_gentlegurl_crm/src/components/PosPageContent.tsx');

        $this->assertStringContainsString('booking-product-categories:${selectedBranchId}', $frontend);
        $this->assertStringContainsString("if (catalogTab === 'booking-products')", $frontend);
        $this->assertStringContainsString("pos: '1', store_location_id: String(selectedBranchId)", $frontend);
        $this->assertStringContainsString('setSelectedCategoryId(null)', $frontend);
        $this->assertStringContainsString('setSelectedBookingProductCategoryId(null)', $frontend);
    }

    public function test_no_category_branch_pivot_was_introduced_and_lookup_indexes_exist(): void
    {
        $migrations = glob(__DIR__.'/../../database/migrations/*.php') ?: [];
        $source = implode("\n", array_map(fn (string $path) => (string) file_get_contents($path), $migrations));

        $this->assertStringNotContainsString('category_store_location', $source);
        $this->assertStringContainsString("unique(['store_location_id', 'product_id']", $source);
        $this->assertStringContainsString("index(['store_location_id', 'booking_product_id']", $source);
    }

    private function read(string $path): string
    {
        return (string) file_get_contents(__DIR__.'/'.$path);
    }
}
