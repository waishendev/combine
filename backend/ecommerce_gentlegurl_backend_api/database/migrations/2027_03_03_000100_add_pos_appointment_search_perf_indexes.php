<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Safe POS appointments performance indexes.
 *
 * - bookings (store_location_id, status, start_at): Request Center / status+branch lists
 * - pos_cart_service_items (assigned_staff_id, start_at): availability POS-cart overlap
 *
 * PostgreSQL uses CREATE INDEX CONCURRENTLY outside a transaction.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const BOOKINGS_INDEX = 'bookings_store_status_start_index';

    private const POS_CART_INDEX = 'pos_cart_service_items_assigned_staff_start_index';

    public function up(): void
    {
        if (Schema::hasTable('bookings') && ! $this->indexExists('bookings', self::BOOKINGS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::BOOKINGS_INDEX
                    .' ON bookings (store_location_id, status, start_at)'
                );
            } else {
                Schema::table('bookings', function (Blueprint $table) {
                    $table->index(['store_location_id', 'status', 'start_at'], self::BOOKINGS_INDEX);
                });
            }
        }

        if (Schema::hasTable('pos_cart_service_items') && ! $this->indexExists('pos_cart_service_items', self::POS_CART_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::POS_CART_INDEX
                    .' ON pos_cart_service_items (assigned_staff_id, start_at)'
                );
            } else {
                Schema::table('pos_cart_service_items', function (Blueprint $table) {
                    $table->index(['assigned_staff_id', 'start_at'], self::POS_CART_INDEX);
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('bookings') && $this->indexExists('bookings', self::BOOKINGS_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.self::BOOKINGS_INDEX);
            } else {
                Schema::table('bookings', function (Blueprint $table) {
                    $table->dropIndex(self::BOOKINGS_INDEX);
                });
            }
        }

        if (Schema::hasTable('pos_cart_service_items') && $this->indexExists('pos_cart_service_items', self::POS_CART_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.self::POS_CART_INDEX);
            } else {
                Schema::table('pos_cart_service_items', function (Blueprint $table) {
                    $table->dropIndex(self::POS_CART_INDEX);
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
};
