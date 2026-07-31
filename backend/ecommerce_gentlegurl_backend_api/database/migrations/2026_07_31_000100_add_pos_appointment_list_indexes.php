<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * P0 POS appointments list indexes.
 *
 * PostgreSQL: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 * Laravel wraps migrations in a transaction by default, so this migration
 * disables that for all drivers and uses CONCURRENTLY only on pgsql.
 */
return new class extends Migration
{
    /**
     * Required so PostgreSQL can use CREATE INDEX CONCURRENTLY.
     */
    public $withinTransaction = false;

    private const ORDER_ITEMS_INDEX = 'order_items_booking_id_line_type_index';

    private const ORDER_SERVICE_ITEMS_INDEX = 'order_service_items_booking_id_index';

    public function up(): void
    {
        if (Schema::hasTable('order_items') && ! $this->indexExists('order_items', self::ORDER_ITEMS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::ORDER_ITEMS_INDEX.' ON order_items (booking_id, line_type)');
            } else {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->index(['booking_id', 'line_type'], self::ORDER_ITEMS_INDEX);
                });
            }
        }

        if (Schema::hasTable('order_service_items') && ! $this->indexExists('order_service_items', self::ORDER_SERVICE_ITEMS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::ORDER_SERVICE_ITEMS_INDEX.' ON order_service_items (booking_id)');
            } else {
                Schema::table('order_service_items', function (Blueprint $table) {
                    $table->index(['booking_id'], self::ORDER_SERVICE_ITEMS_INDEX);
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_items') && $this->indexExists('order_items', self::ORDER_ITEMS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.self::ORDER_ITEMS_INDEX);
            } else {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->dropIndex(self::ORDER_ITEMS_INDEX);
                });
            }
        }

        if (Schema::hasTable('order_service_items') && $this->indexExists('order_service_items', self::ORDER_SERVICE_ITEMS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.self::ORDER_SERVICE_ITEMS_INDEX);
            } else {
                Schema::table('order_service_items', function (Blueprint $table) {
                    $table->dropIndex(self::ORDER_SERVICE_ITEMS_INDEX);
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

        // MySQL / MariaDB
        $database = $connection->getDatabaseName();

        return (bool) $connection->selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $indexName]
        );
    }
};
