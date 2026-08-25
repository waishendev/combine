<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * products-categories-query-v1 — list/filter indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_categories')) {
            Schema::table('product_categories', function (Blueprint $table) {
                if (! $this->indexExists('product_categories', 'product_categories_category_id_idx')) {
                    $table->index('category_id', 'product_categories_category_id_idx');
                }
            });
        }

        if (Schema::hasTable('categories')) {
            Schema::table('categories', function (Blueprint $table) {
                if (! $this->indexExists('categories', 'categories_sort_order_idx')) {
                    $table->index('sort_order', 'categories_sort_order_idx');
                }
                if (! $this->indexExists('categories', 'categories_is_active_sort_order_idx')) {
                    $table->index(['is_active', 'sort_order'], 'categories_is_active_sort_order_idx');
                }
            });
        }

        if (Schema::hasTable('products') && Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS products_is_reward_only_id_idx ON products (is_reward_only, id DESC)');
        } elseif (Schema::hasTable('products')) {
            Schema::table('products', function (Blueprint $table) {
                if (! $this->indexExists('products', 'products_is_reward_only_id_idx')) {
                    $table->index(['is_reward_only', 'id'], 'products_is_reward_only_id_idx');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_categories')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->dropIndex('product_categories_category_id_idx');
            });
        }

        if (Schema::hasTable('categories')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropIndex('categories_sort_order_idx');
                $table->dropIndex('categories_is_active_sort_order_idx');
            });
        }

        if (Schema::hasTable('products')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('DROP INDEX IF EXISTS products_is_reward_only_id_idx');
            } else {
                Schema::table('products', function (Blueprint $table) {
                    $table->dropIndex('products_is_reward_only_id_idx');
                });
            }
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            return (bool) DB::selectOne(
                'SELECT 1 AS ok FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName]
            );
        }

        if ($driver === 'mysql') {
            return (bool) DB::selectOne(
                'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
                [$table, $indexName]
            );
        }

        return false;
    }
};
