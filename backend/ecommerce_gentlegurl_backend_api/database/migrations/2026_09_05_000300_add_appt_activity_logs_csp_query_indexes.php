<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * appt-activity-logs-csp-query-v1 — list indexes.
 */
return new class extends Migration
{
    private const ACTIVITY_MODEL_CREATED = 'activity_logs_model_type_created_at_desc_idx';

    private const ACTIVITY_MODEL_ACTION_CREATED = 'activity_logs_model_type_action_created_at_desc_idx';

    private const USAGES_CUSTOMER_ID = 'csp_usages_customer_id_id_desc_idx';

    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('activity_logs')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::ACTIVITY_MODEL_CREATED
                    .' ON activity_logs (model_type, created_at DESC)'
                );
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::ACTIVITY_MODEL_ACTION_CREATED
                    .' ON activity_logs (model_type, action, created_at DESC)'
                );
            } else {
                Schema::table('activity_logs', function (Blueprint $table) {
                    if (! $this->indexExists('activity_logs', self::ACTIVITY_MODEL_CREATED)) {
                        $table->index(['model_type', 'created_at'], self::ACTIVITY_MODEL_CREATED);
                    }
                    if (! $this->indexExists('activity_logs', self::ACTIVITY_MODEL_ACTION_CREATED)) {
                        $table->index(['model_type', 'action', 'created_at'], self::ACTIVITY_MODEL_ACTION_CREATED);
                    }
                });
            }
        }

        if (Schema::hasTable('customer_service_package_usages') && Schema::hasColumn('customer_service_package_usages', 'customer_id')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::USAGES_CUSTOMER_ID
                    .' ON customer_service_package_usages (customer_id, id DESC)'
                );
            } else {
                Schema::table('customer_service_package_usages', function (Blueprint $table) {
                    if (! $this->indexExists('customer_service_package_usages', self::USAGES_CUSTOMER_ID)) {
                        $table->index(['customer_id', 'id'], self::USAGES_CUSTOMER_ID);
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        foreach ([
            [self::USAGES_CUSTOMER_ID, 'customer_service_package_usages'],
            [self::ACTIVITY_MODEL_ACTION_CREATED, 'activity_logs'],
            [self::ACTIVITY_MODEL_CREATED, 'activity_logs'],
        ] as [$index, $table]) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            if ($pgsql) {
                DB::statement('DROP INDEX IF EXISTS '.$index);
            } elseif ($this->indexExists($table, $index)) {
                Schema::table($table, function (Blueprint $blueprint) use ($index) {
                    $blueprint->dropIndex($index);
                });
            }
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'pgsql') {
            return (bool) DB::selectOne('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?', [$table, $index]);
        }

        $dbName = Schema::getConnection()->getDatabaseName();

        return (bool) DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$dbName, $table, $index]
        );
    }
};
