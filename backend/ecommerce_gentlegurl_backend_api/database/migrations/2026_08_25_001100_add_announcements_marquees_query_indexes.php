<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * announcements-marquees-query-v1 — list/move/filter indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('announcements')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS announcements_type_sort_id_idx ON announcements (type, sort_order, id DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS announcements_type_active_sort_idx ON announcements (type, is_active, sort_order)');
            } else {
                Schema::table('announcements', function (Blueprint $table) {
                    if (! $this->indexExists('announcements', 'announcements_type_sort_id_idx')) {
                        $table->index(['type', 'sort_order', 'id'], 'announcements_type_sort_id_idx');
                    }
                    if (! $this->indexExists('announcements', 'announcements_type_active_sort_idx')) {
                        $table->index(['type', 'is_active', 'sort_order'], 'announcements_type_active_sort_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('marquees')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS marquees_type_sort_id_idx ON marquees (type, sort_order, id DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS marquees_type_active_sort_idx ON marquees (type, is_active, sort_order)');
            } else {
                Schema::table('marquees', function (Blueprint $table) {
                    if (! $this->indexExists('marquees', 'marquees_type_sort_id_idx')) {
                        $table->index(['type', 'sort_order', 'id'], 'marquees_type_sort_id_idx');
                    }
                    if (! $this->indexExists('marquees', 'marquees_type_active_sort_idx')) {
                        $table->index(['type', 'is_active', 'sort_order'], 'marquees_type_active_sort_idx');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        foreach ([
            'announcements' => [
                'announcements_type_sort_id_idx',
                'announcements_type_active_sort_idx',
            ],
            'marquees' => [
                'marquees_type_sort_id_idx',
                'marquees_type_active_sort_idx',
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
