<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * wishlist-product-profit-query-v1 — report indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('customer_wishlist_items')) {
            if ($pgsql) {
                DB::statement('CREATE INDEX IF NOT EXISTS customer_wishlist_items_product_created_idx ON customer_wishlist_items (product_id, created_at)');
            } else {
                Schema::table('customer_wishlist_items', function (Blueprint $table) {
                    if (! $this->indexExists('customer_wishlist_items', 'customer_wishlist_items_product_created_idx')) {
                        $table->index(['product_id', 'created_at'], 'customer_wishlist_items_product_created_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('guest_wishlist_items')) {
            if ($pgsql) {
                DB::statement('CREATE INDEX IF NOT EXISTS guest_wishlist_items_product_created_idx ON guest_wishlist_items (product_id, created_at)');
            } else {
                Schema::table('guest_wishlist_items', function (Blueprint $table) {
                    if (! $this->indexExists('guest_wishlist_items', 'guest_wishlist_items_product_created_idx')) {
                        $table->index(['product_id', 'created_at'], 'guest_wishlist_items_product_created_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('orders') && Schema::hasColumns('orders', ['store_location_id', 'placed_at', 'created_at'])) {
            if ($pgsql) {
                DB::statement('CREATE INDEX IF NOT EXISTS orders_store_bill_at_coalesce_idx ON orders (store_location_id, (COALESCE(placed_at, created_at)))');
            }
        }

        if (Schema::hasTable('order_items')) {
            if ($pgsql) {
                DB::statement(
                    "CREATE INDEX IF NOT EXISTS order_items_product_line_order_idx ON order_items (product_id, order_id) WHERE product_id IS NOT NULL AND (line_type IS NULL OR line_type = 'product')"
                );
            } else {
                Schema::table('order_items', function (Blueprint $table) {
                    if (! $this->indexExists('order_items', 'order_items_product_id_order_id_idx')) {
                        $table->index(['product_id', 'order_id'], 'order_items_product_id_order_id_idx');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        foreach ([
            'customer_wishlist_items_product_created_idx',
            'guest_wishlist_items_product_created_idx',
            'orders_store_bill_at_coalesce_idx',
            'order_items_product_line_order_idx',
            'order_items_product_id_order_id_idx',
        ] as $index) {
            if ($pgsql) {
                DB::statement("DROP INDEX IF EXISTS {$index}");
            } else {
                foreach (['customer_wishlist_items', 'guest_wishlist_items', 'order_items'] as $table) {
                    if (Schema::hasTable($table) && $this->indexExists($table, $index)) {
                        Schema::table($table, function (Blueprint $blueprint) use ($table, $index) {
                            $blueprint->dropIndex($index);
                        });
                    }
                }
            }
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            return (bool) DB::selectOne('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?', [$table, $index]);
        }

        $dbName = Schema::getConnection()->getDatabaseName();
        $row = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$dbName, $table, $index]
        );

        return (bool) $row;
    }
};
