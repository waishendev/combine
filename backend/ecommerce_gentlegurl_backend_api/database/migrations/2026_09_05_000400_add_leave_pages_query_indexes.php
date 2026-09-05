<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * leave-pages-query-v1 — list / usage indexes for leave requests, balances, logs.
 */
return new class extends Migration
{
    private const REQUESTS_BRANCH_STATUS_CREATED = 'leave_requests_branch_status_created_at_desc_idx';

    private const REQUESTS_STAFF_STATUS_TYPE = 'leave_requests_staff_status_leave_type_idx';

    private const LOGS_STAFF_ACTION_CREATED = 'leave_logs_staff_action_created_at_desc_idx';

    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('booking_leave_requests')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::REQUESTS_BRANCH_STATUS_CREATED
                    .' ON booking_leave_requests (store_location_id, status, created_at DESC)'
                );
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::REQUESTS_STAFF_STATUS_TYPE
                    .' ON booking_leave_requests (staff_id, status, leave_type) INCLUDE (days)'
                );
            } else {
                Schema::table('booking_leave_requests', function (Blueprint $table) {
                    if (! $this->indexExists('booking_leave_requests', self::REQUESTS_BRANCH_STATUS_CREATED)) {
                        $table->index(
                            ['store_location_id', 'status', 'created_at'],
                            self::REQUESTS_BRANCH_STATUS_CREATED
                        );
                    }
                    if (! $this->indexExists('booking_leave_requests', self::REQUESTS_STAFF_STATUS_TYPE)) {
                        $table->index(
                            ['staff_id', 'status', 'leave_type'],
                            self::REQUESTS_STAFF_STATUS_TYPE
                        );
                    }
                });
            }
        }

        if (Schema::hasTable('booking_leave_logs')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::LOGS_STAFF_ACTION_CREATED
                    .' ON booking_leave_logs (staff_id, action_type, created_at DESC)'
                );
            } else {
                Schema::table('booking_leave_logs', function (Blueprint $table) {
                    if (! $this->indexExists('booking_leave_logs', self::LOGS_STAFF_ACTION_CREATED)) {
                        $table->index(
                            ['staff_id', 'action_type', 'created_at'],
                            self::LOGS_STAFF_ACTION_CREATED
                        );
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('booking_leave_requests')) {
            if ($pgsql) {
                DB::statement('DROP INDEX IF EXISTS '.self::REQUESTS_BRANCH_STATUS_CREATED);
                DB::statement('DROP INDEX IF EXISTS '.self::REQUESTS_STAFF_STATUS_TYPE);
            } else {
                Schema::table('booking_leave_requests', function (Blueprint $table) {
                    if ($this->indexExists('booking_leave_requests', self::REQUESTS_BRANCH_STATUS_CREATED)) {
                        $table->dropIndex(self::REQUESTS_BRANCH_STATUS_CREATED);
                    }
                    if ($this->indexExists('booking_leave_requests', self::REQUESTS_STAFF_STATUS_TYPE)) {
                        $table->dropIndex(self::REQUESTS_STAFF_STATUS_TYPE);
                    }
                });
            }
        }

        if (Schema::hasTable('booking_leave_logs')) {
            if ($pgsql) {
                DB::statement('DROP INDEX IF EXISTS '.self::LOGS_STAFF_ACTION_CREATED);
            } else {
                Schema::table('booking_leave_logs', function (Blueprint $table) {
                    if ($this->indexExists('booking_leave_logs', self::LOGS_STAFF_ACTION_CREATED)) {
                        $table->dropIndex(self::LOGS_STAFF_ACTION_CREATED);
                    }
                });
            }
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $schema = $connection->getSchemaBuilder();

        if (method_exists($schema, 'hasIndex')) {
            return $schema->hasIndex($table, $index);
        }

        $database = $connection->getDatabaseName();
        $rows = $connection->select(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $index]
        );

        return ! empty($rows);
    }
};
