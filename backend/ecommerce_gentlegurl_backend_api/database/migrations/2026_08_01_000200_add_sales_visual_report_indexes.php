<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * P0 sales visual / channel report indexes.
 *
 * - order_item_staff_splits(order_item_id): Postgres does not auto-index FKs;
 *   the unique (order_item_id, staff_id) was dropped, leaving PK-only access for
 *   per-line snapshot lookups on the booking sales report.
 * - orders ((COALESCE(placed_at, created_at))): report SQL filters with the same
 *   expression via whereBetween (timestamp range), so an expression index matches
 *   the predicate without changing date semantics.
 * - order_items (line_type, order_id): EXISTS / workspace line filters Seq Scan today.
 * - customer_service_package_usages (booking_service_id, status): package applied/name lookups.
 *
 * PostgreSQL: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const STAFF_SPLITS_INDEX = 'order_item_staff_splits_order_item_id_index';

    private const ORDERS_BILL_AT_INDEX = 'orders_bill_at_coalesce_index';

    private const ORDER_ITEMS_LINE_TYPE_INDEX = 'order_items_line_type_order_id_index';

    private const CSP_USAGES_INDEX = 'csp_usages_booking_service_id_status_index';

    public function up(): void
    {
        if (Schema::hasTable('order_item_staff_splits') && ! $this->indexExists('order_item_staff_splits', self::STAFF_SPLITS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::STAFF_SPLITS_INDEX
                    .' ON order_item_staff_splits (order_item_id)'
                );
            } else {
                Schema::table('order_item_staff_splits', function (Blueprint $table) {
                    $table->index(['order_item_id'], self::STAFF_SPLITS_INDEX);
                });
            }
        }

        if (Schema::hasTable('orders') && ! $this->indexExists('orders', self::ORDERS_BILL_AT_INDEX)) {
            if ($this->isPostgres()) {
                // Must match SalesChannelReportService / SalesVisualDailyReportService orderBillAtSql():
                // COALESCE(placed_at, created_at) compared with timestamp whereBetween (not date-cast).
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::ORDERS_BILL_AT_INDEX
                    .' ON orders ((COALESCE(placed_at, created_at)))'
                );
            }
            // Non-Postgres: expression indexes are dialect-specific; skip rather than change semantics.
        }

        if (Schema::hasTable('order_items') && ! $this->indexExists('order_items', self::ORDER_ITEMS_LINE_TYPE_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::ORDER_ITEMS_LINE_TYPE_INDEX
                    .' ON order_items (line_type, order_id)'
                );
            } else {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->index(['line_type', 'order_id'], self::ORDER_ITEMS_LINE_TYPE_INDEX);
                });
            }
        }

        if (Schema::hasTable('customer_service_package_usages') && ! $this->indexExists('customer_service_package_usages', self::CSP_USAGES_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::CSP_USAGES_INDEX
                    .' ON customer_service_package_usages (booking_service_id, status)'
                );
            } else {
                Schema::table('customer_service_package_usages', function (Blueprint $table) {
                    $table->index(['booking_service_id', 'status'], self::CSP_USAGES_INDEX);
                });
            }
        }
    }

    public function down(): void
    {
        $this->dropIndexIfExists('order_item_staff_splits', self::STAFF_SPLITS_INDEX);
        $this->dropIndexIfExists('orders', self::ORDERS_BILL_AT_INDEX);
        $this->dropIndexIfExists('order_items', self::ORDER_ITEMS_LINE_TYPE_INDEX);
        $this->dropIndexIfExists('customer_service_package_usages', self::CSP_USAGES_INDEX);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        if ($this->isPostgres()) {
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.$indexName);

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
            $blueprint->dropIndex($indexName);
        });
    }

    private function isPostgres(): bool
    {
        return Schema::getConnection()->getDriverName() === 'pgsql';
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'pgsql') {
            return (bool) $connection->selectOne(
                'SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName]
            );
        }

        if ($driver === 'sqlite') {
            $rows = $connection->select('PRAGMA index_list('.$table.')');
            foreach ($rows as $row) {
                $name = is_array($row) ? ($row['name'] ?? null) : ($row->name ?? null);
                if ($name === $indexName) {
                    return true;
                }
            }

            return false;
        }

        $database = $connection->getDatabaseName();

        return (bool) $connection->selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $indexName]
        );
    }
};
