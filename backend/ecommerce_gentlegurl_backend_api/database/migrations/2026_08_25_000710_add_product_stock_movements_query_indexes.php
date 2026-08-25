<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * products-categories-query-v1b — stock movement list indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_stock_movements')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS psm_product_id_id_idx ON product_stock_movements (product_id, id DESC)');
            DB::statement('CREATE INDEX IF NOT EXISTS psm_created_at_id_idx ON product_stock_movements (created_at DESC, id DESC)');
            DB::statement('CREATE INDEX IF NOT EXISTS psm_reversal_of_movement_id_idx ON product_stock_movements (reversal_of_movement_id) WHERE reversal_of_movement_id IS NOT NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS psm_revokable_lookup_idx ON product_stock_movements (is_revoked, type, id DESC)');

            return;
        }

        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (! $this->indexExists('product_stock_movements', 'psm_product_id_id_idx')) {
                $table->index(['product_id', 'id'], 'psm_product_id_id_idx');
            }
            if (! $this->indexExists('product_stock_movements', 'psm_created_at_id_idx')) {
                $table->index(['created_at', 'id'], 'psm_created_at_id_idx');
            }
            if (! $this->indexExists('product_stock_movements', 'psm_reversal_of_movement_id_idx')) {
                $table->index('reversal_of_movement_id', 'psm_reversal_of_movement_id_idx');
            }
            if (! $this->indexExists('product_stock_movements', 'psm_revokable_lookup_idx')) {
                $table->index(['is_revoked', 'type', 'id'], 'psm_revokable_lookup_idx');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_stock_movements')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS psm_product_id_id_idx');
            DB::statement('DROP INDEX IF EXISTS psm_created_at_id_idx');
            DB::statement('DROP INDEX IF EXISTS psm_reversal_of_movement_id_idx');
            DB::statement('DROP INDEX IF EXISTS psm_revokable_lookup_idx');

            return;
        }

        Schema::table('product_stock_movements', function (Blueprint $table) {
            $table->dropIndex('psm_product_id_id_idx');
            $table->dropIndex('psm_created_at_id_idx');
            $table->dropIndex('psm_reversal_of_movement_id_idx');
            $table->dropIndex('psm_revokable_lookup_idx');
        });
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
