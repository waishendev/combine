<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * membership-loyalty-store-query-v1 — list/sort + FK indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('store_locations')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS store_locations_sort_order_name_idx ON store_locations (sort_order, name)');
            } else {
                Schema::table('store_locations', function (Blueprint $table) {
                    if (! $this->indexExists('store_locations', 'store_locations_sort_order_name_idx')) {
                        $table->index(['sort_order', 'name'], 'store_locations_sort_order_name_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('store_location_images')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS store_location_images_store_sort_idx ON store_location_images (store_location_id, sort_order, id)');
            } else {
                Schema::table('store_location_images', function (Blueprint $table) {
                    if (! $this->indexExists('store_location_images', 'store_location_images_store_sort_idx')) {
                        $table->index(['store_location_id', 'sort_order', 'id'], 'store_location_images_store_sort_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('loyalty_settings')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS loyalty_settings_effective_created_idx ON loyalty_settings (rules_effective_at DESC NULLS LAST, created_at DESC)');
            } else {
                Schema::table('loyalty_settings', function (Blueprint $table) {
                    if (! $this->indexExists('loyalty_settings', 'loyalty_settings_effective_created_idx')) {
                        $table->index(['rules_effective_at', 'created_at'], 'loyalty_settings_effective_created_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('membership_tier_rules')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS membership_tier_rules_active_spent_sort_idx ON membership_tier_rules (is_active, min_spent_last_x_months, sort_order)');
                DB::statement('CREATE INDEX IF NOT EXISTS membership_tier_rules_sort_order_idx ON membership_tier_rules (sort_order)');
            } else {
                Schema::table('membership_tier_rules', function (Blueprint $table) {
                    if (! $this->indexExists('membership_tier_rules', 'membership_tier_rules_active_spent_sort_idx')) {
                        $table->index(['is_active', 'min_spent_last_x_months', 'sort_order'], 'membership_tier_rules_active_spent_sort_idx');
                    }
                    if (! $this->indexExists('membership_tier_rules', 'membership_tier_rules_sort_order_idx')) {
                        $table->index('sort_order', 'membership_tier_rules_sort_order_idx');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        foreach ([
            'store_locations' => ['store_locations_sort_order_name_idx'],
            'store_location_images' => ['store_location_images_store_sort_idx'],
            'loyalty_settings' => ['loyalty_settings_effective_created_idx'],
            'membership_tier_rules' => [
                'membership_tier_rules_active_spent_sort_idx',
                'membership_tier_rules_sort_order_idx',
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
