<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * catalog-menus-query-v1 — indexes for shop/services menus + category pivot.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('shop_menu_items')) {
            Schema::table('shop_menu_items', function (Blueprint $table) {
                if (! $this->indexExists('shop_menu_items', 'shop_menu_items_sort_order_idx')) {
                    $table->index('sort_order', 'shop_menu_items_sort_order_idx');
                }
                if (! $this->indexExists('shop_menu_items', 'shop_menu_items_is_active_sort_order_idx')) {
                    $table->index(['is_active', 'sort_order'], 'shop_menu_items_is_active_sort_order_idx');
                }
            });
        }

        if (Schema::hasTable('services_menu_items')) {
            Schema::table('services_menu_items', function (Blueprint $table) {
                if (! $this->indexExists('services_menu_items', 'services_menu_items_sort_order_idx')) {
                    $table->index('sort_order', 'services_menu_items_sort_order_idx');
                }
                if (! $this->indexExists('services_menu_items', 'services_menu_items_is_active_sort_order_idx')) {
                    $table->index(['is_active', 'sort_order'], 'services_menu_items_is_active_sort_order_idx');
                }
            });
        }

        if (Schema::hasTable('category_shop_menu_items')) {
            Schema::table('category_shop_menu_items', function (Blueprint $table) {
                if (! $this->indexExists('category_shop_menu_items', 'category_shop_menu_items_shop_menu_item_id_idx')) {
                    $table->index('shop_menu_item_id', 'category_shop_menu_items_shop_menu_item_id_idx');
                }
                if (! $this->indexExists('category_shop_menu_items', 'category_shop_menu_items_category_id_idx')) {
                    $table->index('category_id', 'category_shop_menu_items_category_id_idx');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('shop_menu_items')) {
            Schema::table('shop_menu_items', function (Blueprint $table) {
                $table->dropIndex('shop_menu_items_sort_order_idx');
                $table->dropIndex('shop_menu_items_is_active_sort_order_idx');
            });
        }

        if (Schema::hasTable('services_menu_items')) {
            Schema::table('services_menu_items', function (Blueprint $table) {
                $table->dropIndex('services_menu_items_sort_order_idx');
                $table->dropIndex('services_menu_items_is_active_sort_order_idx');
            });
        }

        if (Schema::hasTable('category_shop_menu_items')) {
            Schema::table('category_shop_menu_items', function (Blueprint $table) {
                $table->dropIndex('category_shop_menu_items_shop_menu_item_id_idx');
                $table->dropIndex('category_shop_menu_items_category_id_idx');
            });
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            $row = DB::selectOne(
                'SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName]
            );

            return (bool) $row;
        }

        if ($driver === 'mysql') {
            $row = DB::selectOne(
                'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
                [$table, $indexName]
            );

            return (bool) $row;
        }

        return false;
    }
};
