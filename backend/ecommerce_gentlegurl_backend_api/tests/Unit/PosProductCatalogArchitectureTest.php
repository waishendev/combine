<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PosProductCatalogArchitectureTest extends TestCase
{
    public function test_catalog_is_branch_authorized_and_reads_snapshot_inventory(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');
        $start = strpos($source, 'public function productCatalog');
        $end = strpos($source, 'public function staffConsumableProducts', $start);
        $method = substr($source, $start, $end - $start);

        $this->assertStringContainsString('authorizeStoreLocation($request->user(), $branchId)', $method);
        $this->assertStringContainsString("where('store_location_product.is_available', true)", $method);
        $this->assertStringContainsString('StoreLocationProductInventory::query()', $method);
        $this->assertStringNotContainsString('ProductStockMovement::', $method);
    }

    public function test_catalog_contract_contains_checkout_grid_fields(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PosController.php');
        $start = strpos($source, 'public function productCatalog');
        $end = strpos($source, 'public function staffConsumableProducts', $start);
        $method = substr($source, $start, $end - $start);

        foreach (['product_id', 'name', 'price', 'cover_image_url', 'categories', 'variants', 'stock'] as $field) {
            $this->assertStringContainsString("'{$field}'", $method);
        }
    }
}
