<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class WishlistReportContractTest extends TestCase
{
    public function test_report_is_global_tie_safe_and_variant_demand_is_not_fabricated(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Ecommerce/Reports/WishlistReportController.php'));
        self::assertStringNotContainsString('store_location', $controller);
        self::assertStringContainsString('WishlistReportSemantics::topWishlist', $controller);
        self::assertStringContainsString("'wishlist_count' => null", $controller);
        self::assertStringContainsString("where('product_id', \$product)", $controller);
        self::assertSame(1, substr_count($controller, "DB::table('product_variants')\n            ->where('product_id', \$product)"));
    }

    public function test_view_modal_contract_is_present(): void
    {
        $component = file_get_contents(base_path('../../frontend/ecommerce_gentlegurl_crm/src/components/reports/WishlistReportPage.tsx'));
        self::assertStringContainsString('Wishlist Demand Details', $component);
        self::assertStringContainsString('Not tracked per variant', $component);
        self::assertStringContainsString('aria-label={`View ${row.product_name} wishlist details`}', $component);
        self::assertStringContainsString('/detail?', $component);
    }
}
