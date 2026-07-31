<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard analytics Phase A — indexes only.
 *
 * Targets the ecommerce + package dashboard read paths:
 * - order_items ⨝ orders product sales / refunds
 * - products / product_variants inventory UNION
 * - customer_service_packages status / expiry / service_package joins
 * - customer_service_package_usages reserved-qty correlated lookup
 * - customer_service_package_balances remaining_qty > 0 subquery
 *
 * Redundancy avoided:
 * - Single order_items (order_id, is_package) covers FK lookups on order_id
 *   (leftmost prefix) and the dashboard is_package filter — no separate
 *   order_id-only or (is_package, order_id) index.
 * - Does NOT duplicate customer_service_packages (customer_id, status).
 * - Does NOT duplicate usages (status, booking_id) or (customer_id, booking_service_id).
 *
 * PostgreSQL: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 * Laravel wraps migrations in a transaction by default, so this migration
 * disables that and uses CONCURRENTLY only on pgsql.
 */
return new class extends Migration
{
    /**
     * Required so PostgreSQL can use CREATE INDEX CONCURRENTLY.
     */
    public $withinTransaction = false;

    private const INDEXES = [
        [
            'table' => 'order_items',
            'name' => 'order_items_order_id_is_package_index',
            'columns' => ['order_id', 'is_package'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_order_id_is_package_index ON order_items (order_id, is_package)',
        ],
        [
            'table' => 'orders',
            'name' => 'orders_payment_status_status_index',
            'columns' => ['payment_status', 'status'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_payment_status_status_index ON orders (payment_status, status)',
        ],
        [
            'table' => 'product_variants',
            'name' => 'product_variants_product_id_is_active_index',
            'columns' => ['product_id', 'is_active'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS product_variants_product_id_is_active_index ON product_variants (product_id, is_active)',
        ],
        [
            'table' => 'products',
            'name' => 'products_is_active_name_index',
            'columns' => ['is_active', 'name'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS products_is_active_name_index ON products (is_active, name)',
        ],
        [
            'table' => 'customer_service_package_usages',
            'name' => 'csp_usages_csp_id_status_index',
            'columns' => ['customer_service_package_id', 'status'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS csp_usages_csp_id_status_index ON customer_service_package_usages (customer_service_package_id, status)',
        ],
        [
            'table' => 'customer_service_packages',
            'name' => 'csp_status_expires_at_index',
            'columns' => ['status', 'expires_at'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS csp_status_expires_at_index ON customer_service_packages (status, expires_at)',
        ],
        [
            'table' => 'customer_service_packages',
            'name' => 'csp_service_package_id_index',
            'columns' => ['service_package_id'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS csp_service_package_id_index ON customer_service_packages (service_package_id)',
        ],
        [
            'table' => 'customer_service_package_balances',
            'name' => 'csp_balances_remaining_qty_partial',
            'columns' => ['customer_service_package_id'],
            'partial' => true,
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS csp_balances_remaining_qty_partial ON customer_service_package_balances (customer_service_package_id) WHERE remaining_qty > 0',
            // Non-Postgres fallback cannot express partial easily via Blueprint in older Laravel;
            // use a normal composite only when driver is not pgsql (dev sqlite/mysql).
            'non_pgsql_columns' => ['customer_service_package_id', 'remaining_qty'],
        ],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $index) {
            if (! Schema::hasTable($index['table'])) {
                continue;
            }

            if ($this->indexExists($index['table'], $index['name'])) {
                continue;
            }

            // Skip if an existing index already has the same leading column set
            // (exact column list match), to avoid accidental duplicates under another name.
            if ($this->equivalentIndexExists($index['table'], $index['columns'], (bool) ($index['partial'] ?? false))) {
                continue;
            }

            if ($this->isPostgres()) {
                DB::statement($index['sql']);
            } else {
                $columns = $index['non_pgsql_columns'] ?? $index['columns'];
                Schema::table($index['table'], function (Blueprint $table) use ($index, $columns) {
                    $table->index($columns, $index['name']);
                });
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse(self::INDEXES) as $index) {
            if (! Schema::hasTable($index['table'])) {
                continue;
            }

            if (! $this->indexExists($index['table'], $index['name'])) {
                continue;
            }

            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.$index['name']);
            } else {
                Schema::table($index['table'], function (Blueprint $table) use ($index) {
                    $table->dropIndex($index['name']);
                });
            }
        }
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

    /**
     * Detect an existing btree index whose ordered column list matches $columns.
     * Partial indexes are only considered equivalent to other partials (Postgres).
     */
    private function equivalentIndexExists(string $table, array $columns, bool $partial): bool
    {
        if (! $this->isPostgres()) {
            return false;
        }

        $rows = DB::select(
            "SELECT i.relname AS index_name,
                    pg_get_indexdef(i.oid) AS indexdef,
                    ix.indisunique,
                    (ix.indpred IS NOT NULL) AS is_partial
             FROM pg_class t
             JOIN pg_index ix ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE n.nspname = current_schema()
               AND t.relname = ?
               AND ix.indisvalid",
            [$table]
        );

        $wanted = array_map('strtolower', $columns);

        foreach ($rows as $row) {
            if ((bool) $row->is_partial !== $partial) {
                continue;
            }

            if (! preg_match('/\(([^)]+)\)/', $row->indexdef, $m)) {
                continue;
            }

            // For partial indexes the WHERE clause also has parens; use the first (...) after ON table
            if (! preg_match('/ON\s+\S+\s+USING\s+\w+\s*\(([^)]+)\)/i', $row->indexdef, $m)
                && ! preg_match('/ON\s+\S+\s*\(([^)]+)\)/i', $row->indexdef, $m)) {
                continue;
            }

            $existing = array_map(
                static fn (string $part) => strtolower(trim(str_replace('"', '', $part))),
                explode(',', $m[1])
            );

            if ($existing === $wanted) {
                return true;
            }
        }

        return false;
    }
};
