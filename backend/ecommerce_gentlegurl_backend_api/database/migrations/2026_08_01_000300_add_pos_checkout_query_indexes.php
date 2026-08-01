<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * POS checkout low-risk indexes:
 * - customer_service_package_usages (used_from, used_ref_id): cart serialize / claim lookups
 * - orders (customer_id, created_at DESC): member detail order history + aggregates
 *
 * PostgreSQL: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    private const CSP_USAGES_INDEX = 'csp_usages_used_from_used_ref_id_index';

    private const ORDERS_CUSTOMER_INDEX = 'orders_customer_id_created_at_index';

    public function up(): void
    {
        if (Schema::hasTable('customer_service_package_usages') && ! $this->indexExists('customer_service_package_usages', self::CSP_USAGES_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::CSP_USAGES_INDEX
                    .' ON customer_service_package_usages (used_from, used_ref_id)'
                );
            } else {
                Schema::table('customer_service_package_usages', function (Blueprint $table) {
                    $table->index(['used_from', 'used_ref_id'], self::CSP_USAGES_INDEX);
                });
            }
        }

        if (Schema::hasTable('orders') && ! $this->indexExists('orders', self::ORDERS_CUSTOMER_INDEX)) {
            if ($this->isPostgres()) {
                DB::statement(
                    'CREATE INDEX CONCURRENTLY IF NOT EXISTS '.self::ORDERS_CUSTOMER_INDEX
                    .' ON orders (customer_id, created_at DESC)'
                );
            } else {
                Schema::table('orders', function (Blueprint $table) {
                    $table->index(['customer_id', 'created_at'], self::ORDERS_CUSTOMER_INDEX);
                });
            }
        }
    }

    public function down(): void
    {
        $this->dropIndexIfExists('customer_service_package_usages', self::CSP_USAGES_INDEX);
        $this->dropIndexIfExists('orders', self::ORDERS_CUSTOMER_INDEX);
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        if ($this->isPostgres()) {
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS '.$indexName);

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
            $blueprint->dropIndex($indexName);
        });
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
