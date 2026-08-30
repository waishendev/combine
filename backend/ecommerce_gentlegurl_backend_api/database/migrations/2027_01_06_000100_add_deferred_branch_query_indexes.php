<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Installs indexes intentionally skipped by 2026 performance migrations when a
 * pre-Multi-Branch database had not reached the 2027 Branch schema yet.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const INDEXES = [
        ['table' => 'orders', 'name' => 'orders_store_location_payment_status_index', 'columns' => ['store_location_id', 'payment_status', 'status']],
        ['table' => 'store_location_product', 'name' => 'slp_available_product_partial', 'columns' => ['product_id', 'store_location_id', 'is_available'], 'pgsql' => 'CREATE INDEX CONCURRENTLY IF NOT EXISTS slp_available_product_partial ON store_location_product (product_id, store_location_id) WHERE is_available = true'],
        ['table' => 'store_location_product_inventories', 'name' => 'slpi_product_variant_store_qty_index', 'columns' => ['product_id', 'product_variant_id', 'store_location_id']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $index) {
            if (! Schema::hasTable($index['table']) || ! Schema::hasColumns($index['table'], $index['columns'])) {
                continue;
            }
            if ($this->isPostgres()) {
                $sql = $index['pgsql'] ?? sprintf(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS %s ON %s (%s)',
                    $index['name'], $index['table'], implode(', ', $index['columns'])
                );
                DB::statement($sql);
            } elseif (! $this->indexExists($index['table'], $index['name'])) {
                Schema::table($index['table'], fn (Blueprint $table) => $table->index($index['columns'], $index['name']));
            }
        }

        // These columns are introduced separately in late 2026/early 2027 too.
        if ($this->isPostgres() && Schema::hasTable('orders')
            && Schema::hasColumns('orders', ['store_location_id', 'created_at', 'created_by_user_id'])) {
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_store_created_at_idx ON orders (store_location_id, created_at DESC) WHERE created_by_user_id IS NULL');
        }
        if ($this->isPostgres() && Schema::hasTable('orders')
            && Schema::hasColumns('orders', ['status', 'created_at', 'created_by_user_id'])) {
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_status_created_at_idx ON orders (status, created_at DESC) WHERE created_by_user_id IS NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS orders_created_by_user_id_idx ON orders (created_by_user_id) WHERE created_by_user_id IS NOT NULL');
        }
        if ($this->isPostgres() && Schema::hasTable('orders')
            && Schema::hasColumns('orders', ['is_booking_checkout', 'created_at', 'order_number', 'created_by_user_id'])) {
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_booking_checkout_created_at_idx ON orders (is_booking_checkout, created_at DESC) WHERE created_by_user_id IS NULL');
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE INDEX IF NOT EXISTS orders_shop_order_number_trgm_idx ON orders USING gin (order_number gin_trgm_ops) WHERE created_by_user_id IS NULL');
        }
    }

    public function down(): void
    {
        $names = array_column(self::INDEXES, 'name');
        array_push($names, 'orders_shop_store_created_at_idx', 'orders_shop_status_created_at_idx', 'orders_created_by_user_id_idx', 'orders_shop_booking_checkout_created_at_idx', 'orders_shop_order_number_trgm_idx');
        foreach ($names as $name) {
            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.$name);
                continue;
            }
            foreach (self::INDEXES as $index) {
                if ($index['name'] === $name && Schema::hasTable($index['table']) && $this->indexExists($index['table'], $name)) {
                    Schema::table($index['table'], fn (Blueprint $table) => $table->dropIndex($name));
                }
            }
        }
    }

    private function isPostgres(): bool
    {
        return Schema::getConnection()->getDriverName() === 'pgsql';
    }

    private function indexExists(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))->contains(fn (array $index) => ($index['name'] ?? null) === $name);
    }
};
