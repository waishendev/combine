<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * vouchers-promotions-query-v1 — list/filter/sort indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vouchers')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS vouchers_created_at_id_idx ON vouchers (created_at DESC, id DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS vouchers_reward_active_created_idx ON vouchers (is_reward_only, is_active, created_at DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS vouchers_type_created_at_idx ON vouchers (type, created_at DESC)');
            } else {
                Schema::table('vouchers', function (Blueprint $table) {
                    if (! $this->indexExists('vouchers', 'vouchers_created_at_id_idx')) {
                        $table->index(['created_at', 'id'], 'vouchers_created_at_id_idx');
                    }
                    if (! $this->indexExists('vouchers', 'vouchers_reward_active_created_idx')) {
                        $table->index(['is_reward_only', 'is_active', 'created_at'], 'vouchers_reward_active_created_idx');
                    }
                    if (! $this->indexExists('vouchers', 'vouchers_type_created_at_idx')) {
                        $table->index(['type', 'created_at'], 'vouchers_type_created_at_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('promotions')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS promotions_priority_id_idx ON promotions (priority DESC, id DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS promotions_is_active_priority_idx ON promotions (is_active, priority DESC, id DESC)');
            } else {
                Schema::table('promotions', function (Blueprint $table) {
                    if (! $this->indexExists('promotions', 'promotions_priority_id_idx')) {
                        $table->index(['priority', 'id'], 'promotions_priority_id_idx');
                    }
                    if (! $this->indexExists('promotions', 'promotions_is_active_priority_idx')) {
                        $table->index(['is_active', 'priority', 'id'], 'promotions_is_active_priority_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('products')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS products_is_active_name_idx ON products (is_active, name)');
            } else {
                Schema::table('products', function (Blueprint $table) {
                    if (! $this->indexExists('products', 'products_is_active_name_idx')) {
                        $table->index(['is_active', 'name'], 'products_is_active_name_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('product_media')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS product_media_product_type_sort_idx ON product_media (product_id, type, sort_order, id)');
            } else {
                Schema::table('product_media', function (Blueprint $table) {
                    if (! $this->indexExists('product_media', 'product_media_product_type_sort_idx')) {
                        $table->index(['product_id', 'type', 'sort_order', 'id'], 'product_media_product_type_sort_idx');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        foreach ([
            'vouchers' => [
                'vouchers_created_at_id_idx',
                'vouchers_reward_active_created_idx',
                'vouchers_type_created_at_idx',
            ],
            'promotions' => [
                'promotions_priority_id_idx',
                'promotions_is_active_priority_idx',
            ],
            'products' => [
                'products_is_active_name_idx',
            ],
            'product_media' => [
                'product_media_product_type_sort_idx',
            ],
        ] as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                foreach ($indexes as $index) {
                    DB::statement("DROP INDEX IF EXISTS {$index}");
                }
            } else {
                Schema::table($table, function (Blueprint $blueprint) use ($indexes) {
                    foreach ($indexes as $index) {
                        $blueprint->dropIndex($index);
                    }
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
