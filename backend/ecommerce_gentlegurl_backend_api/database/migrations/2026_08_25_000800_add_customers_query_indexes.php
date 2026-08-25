<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * customers-query-v1 — list/filter + loyalty aggregate indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customers')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS customers_created_at_id_idx ON customers (created_at DESC, id DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS customers_customer_type_id_idx ON customers (customer_type_id)');
                DB::statement('CREATE INDEX IF NOT EXISTS customers_is_active_created_at_idx ON customers (is_active, created_at DESC)');
                DB::statement('CREATE INDEX IF NOT EXISTS customers_tier_created_at_idx ON customers (tier, created_at DESC)');
            } else {
                Schema::table('customers', function (Blueprint $table) {
                    if (! $this->indexExists('customers', 'customers_created_at_id_idx')) {
                        $table->index(['created_at', 'id'], 'customers_created_at_id_idx');
                    }
                    if (! $this->indexExists('customers', 'customers_customer_type_id_idx')) {
                        $table->index('customer_type_id', 'customers_customer_type_id_idx');
                    }
                    if (! $this->indexExists('customers', 'customers_is_active_created_at_idx')) {
                        $table->index(['is_active', 'created_at'], 'customers_is_active_created_at_idx');
                    }
                    if (! $this->indexExists('customers', 'customers_tier_created_at_idx')) {
                        $table->index(['tier', 'created_at'], 'customers_tier_created_at_idx');
                    }
                });
            }
        }

        if (Schema::hasTable('points_earn_batches')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('CREATE INDEX IF NOT EXISTS peb_customer_remaining_expires_idx ON points_earn_batches (customer_id, expires_at) WHERE points_remaining > 0');
                DB::statement('CREATE INDEX IF NOT EXISTS peb_customer_id_idx ON points_earn_batches (customer_id)');
            } else {
                Schema::table('points_earn_batches', function (Blueprint $table) {
                    if (! $this->indexExists('points_earn_batches', 'peb_customer_id_idx')) {
                        $table->index('customer_id', 'peb_customer_id_idx');
                    }
                    if (! $this->indexExists('points_earn_batches', 'peb_customer_expires_idx')) {
                        $table->index(['customer_id', 'expires_at'], 'peb_customer_expires_idx');
                    }
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customers')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('DROP INDEX IF EXISTS customers_created_at_id_idx');
                DB::statement('DROP INDEX IF EXISTS customers_customer_type_id_idx');
                DB::statement('DROP INDEX IF EXISTS customers_is_active_created_at_idx');
                DB::statement('DROP INDEX IF EXISTS customers_tier_created_at_idx');
            } else {
                Schema::table('customers', function (Blueprint $table) {
                    $table->dropIndex('customers_created_at_id_idx');
                    $table->dropIndex('customers_customer_type_id_idx');
                    $table->dropIndex('customers_is_active_created_at_idx');
                    $table->dropIndex('customers_tier_created_at_idx');
                });
            }
        }

        if (Schema::hasTable('points_earn_batches')) {
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                DB::statement('DROP INDEX IF EXISTS peb_customer_remaining_expires_idx');
                DB::statement('DROP INDEX IF EXISTS peb_customer_id_idx');
            } else {
                Schema::table('points_earn_batches', function (Blueprint $table) {
                    $table->dropIndex('peb_customer_id_idx');
                    $table->dropIndex('peb_customer_expires_idx');
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
