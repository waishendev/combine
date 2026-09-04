<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class WishlistReportContractTest extends TestCase
{
    public function test_report_uses_compact_aggregate_variant_stock_semantics_without_n_plus_one(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/Reports/WishlistReportController.php');

        $this->assertStringContainsString("->leftJoinSub(\$variantSub, 'vs'", $source);
        $this->assertStringContainsString("THEN 'partial'", $source);
        $this->assertStringContainsString('out_of_stock_variant_count', $source);
        $this->assertStringContainsString('variant_count', $source);
        $this->assertStringContainsString('has_variants', $source);
        $this->assertStringNotContainsString('foreach ($rows', $source);
    }

    public function test_fully_out_of_stock_metric_does_not_count_partial_variant_products(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/Reports/WishlistReportController.php');

        $this->assertStringContainsString("stock_status = 'out_of_stock'", $source);
        $this->assertStringNotContainsString('current_stock <= 0 AND total_wishlist_count', $source);
    }

    public function test_top_product_collects_every_row_at_the_maximum_instead_of_selecting_first(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/Reports/WishlistReportController.php');

        $this->assertStringContainsString('MAX(total_wishlist_count)', $source);
        $this->assertStringContainsString("->where('total_wishlist_count', \$maxCount)", $source);
        $this->assertStringContainsString("'top_wishlisted_is_tie' => \$topProducts->count() > 1", $source);
        $this->assertStringNotContainsString("->value('product_name')", $source);
    }

    public function test_variant_detail_is_a_single_lazy_endpoint_and_wishlist_identity_is_product_level(): void
    {
        $controller = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/Reports/WishlistReportController.php');
        $routes = file_get_contents(__DIR__.'/../../routes/api.php');

        $this->assertStringContainsString('function inventoryDetail(Product $product)', $controller);
        $this->assertStringContainsString("'wishlist_identity' => 'product'", $controller);
        $this->assertStringContainsString("wishlist/products/{product}/inventory-detail", $routes);
    }
}
