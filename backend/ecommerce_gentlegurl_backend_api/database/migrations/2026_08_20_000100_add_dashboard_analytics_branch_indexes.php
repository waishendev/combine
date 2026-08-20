<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard analytics Phase C — branch-scope indexes.
 *
 * Complements 2026_08_01_000100 (Phase A). Branch filtering was added later via
 * orders.store_location_id + store_location_product joins; Phase A did not cover those.
 *
 * Targets:
 * - orders sales/refunds filtered by store_location_id + payment_status + status
 * - store_location_product availability lookups by product_id (inventory UNION)
 * - store_location_product_inventories join keys (product, variant, branch)
 *
 * PostgreSQL: CREATE INDEX CONCURRENTLY requires $withinTransaction = false.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const INDEXES = [
        [
            'table' => 'orders',
            'name' => 'orders_store_location_payment_status_index',
            'columns' => ['store_location_id', 'payment_status', 'status'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_store_location_payment_status_index ON orders (store_location_id, payment_status, status)',
        ],
        [
            'table' => 'store_location_product',
            'name' => 'slp_available_product_partial',
            'columns' => ['product_id', 'store_location_id'],
            'partial' => true,
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS slp_available_product_partial ON store_location_product (product_id, store_location_id) WHERE is_available = true',
            'non_pgsql_columns' => ['product_id', 'store_location_id', 'is_available'],
        ],
        [
            'table' => 'store_location_product_inventories',
            'name' => 'slpi_product_variant_store_qty_index',
            'columns' => ['product_id', 'product_variant_id', 'store_location_id'],
            'sql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS slpi_product_variant_store_qty_index ON store_location_product_inventories (product_id, product_variant_id, store_location_id)',
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

    private function equivalentIndexExists(string $table, array $columns, bool $partial): bool
    {
        if (! $this->isPostgres()) {
            return false;
        }

        $rows = DB::select(
            "SELECT i.relname AS index_name,
                    pg_get_indexdef(i.oid) AS indexdef,
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
