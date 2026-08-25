<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * home-sliders-query-v1 — list/move/filter indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('home_sliders')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS home_sliders_type_sort_id_idx ON home_sliders (type, sort_order, id)');
            DB::statement('CREATE INDEX IF NOT EXISTS home_sliders_type_active_sort_idx ON home_sliders (type, is_active, sort_order)');
        } else {
            Schema::table('home_sliders', function (Blueprint $table) {
                if (! $this->indexExists('home_sliders', 'home_sliders_type_sort_id_idx')) {
                    $table->index(['type', 'sort_order', 'id'], 'home_sliders_type_sort_id_idx');
                }
                if (! $this->indexExists('home_sliders', 'home_sliders_type_active_sort_idx')) {
                    $table->index(['type', 'is_active', 'sort_order'], 'home_sliders_type_active_sort_idx');
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('home_sliders')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS home_sliders_type_sort_id_idx');
            DB::statement('DROP INDEX IF EXISTS home_sliders_type_active_sort_idx');
        } else {
            Schema::table('home_sliders', function (Blueprint $table) {
                $table->dropIndex('home_sliders_type_sort_id_idx');
                $table->dropIndex('home_sliders_type_active_sort_idx');
            });
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
