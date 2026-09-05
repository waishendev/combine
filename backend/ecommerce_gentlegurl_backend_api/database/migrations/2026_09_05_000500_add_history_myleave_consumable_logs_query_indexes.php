<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * leave-history-myleave-consumable-logs-query-v1 — my-leave list index.
 */
return new class extends Migration
{
    private const LEAVE_STAFF_CREATED = 'leave_requests_staff_id_created_at_desc_idx';

    public function up(): void
    {
        if (! Schema::hasTable('booking_leave_requests')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement(
                'CREATE INDEX IF NOT EXISTS '.self::LEAVE_STAFF_CREATED
                .' ON booking_leave_requests (staff_id, created_at DESC)'
            );

            return;
        }

        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if (! $this->indexExists('booking_leave_requests', self::LEAVE_STAFF_CREATED)) {
                $table->index(['staff_id', 'created_at'], self::LEAVE_STAFF_CREATED);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('booking_leave_requests')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('DROP INDEX IF EXISTS '.self::LEAVE_STAFF_CREATED);

            return;
        }

        Schema::table('booking_leave_requests', function (Blueprint $table) {
            if ($this->indexExists('booking_leave_requests', self::LEAVE_STAFF_CREATED)) {
                $table->dropIndex(self::LEAVE_STAFF_CREATED);
            }
        });
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
