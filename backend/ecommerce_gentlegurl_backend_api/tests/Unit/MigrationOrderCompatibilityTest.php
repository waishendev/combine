<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class MigrationOrderCompatibilityTest extends TestCase
{
    public function test_early_analytics_indexes_guard_columns_created_by_later_branch_migrations(): void
    {
        $early = file_get_contents(__DIR__.'/../../database/migrations/2026_08_20_000100_add_dashboard_analytics_branch_indexes.php');
        $shop = file_get_contents(__DIR__.'/../../database/migrations/2026_08_25_000400_add_orders_shop_returns_query_indexes.php');
        $shopV2 = file_get_contents(__DIR__.'/../../database/migrations/2026_08_25_000500_add_orders_booking_flag_and_trgm.php');
        $deferredPath = __DIR__.'/../../database/migrations/2027_01_06_000100_add_deferred_branch_query_indexes.php';
        $deferred = file_get_contents($deferredPath);

        $this->assertStringContainsString("Schema::hasColumns(\$index['table'], \$requiredColumns)", $early);
        $this->assertStringContainsString("Schema::hasColumns('orders', ['store_location_id', 'created_at', 'created_by_user_id'])", $shop);
        $this->assertStringContainsString("Schema::hasColumn('orders', 'created_by_user_id')", $shopV2);
        $this->assertFileExists($deferredPath);
        $this->assertStringContainsString('orders_store_location_payment_status_index', $deferred);
        $this->assertStringContainsString('slp_available_product_partial', $deferred);
        $this->assertStringContainsString('slpi_product_variant_store_qty_index', $deferred);
        $this->assertStringContainsString('orders_shop_order_number_trgm_idx', $deferred);
        $this->assertGreaterThan(
            0,
            strcmp('2027_01_06_000100', '2027_01_06_000001'),
            'Deferred indexes must sort after the migration adding orders.store_location_id.'
        );
    }
}
