<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * booking-shop-query-v1 — conflict lookup support for staff + blocking statuses.
 */
return new class extends Migration
{
    private const BOOKINGS_STAFF_STATUS_START = 'bookings_staff_status_start_at_idx';

    public function up(): void
    {
        if (! Schema::hasTable('bookings')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement(
                'CREATE INDEX IF NOT EXISTS '.self::BOOKINGS_STAFF_STATUS_START
                .' ON bookings (staff_id, status, start_at)'
            );

            return;
        }

        if (! $this->indexExists('bookings', self::BOOKINGS_STAFF_STATUS_START)) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->index(['staff_id', 'status', 'start_at'], self::BOOKINGS_STAFF_STATUS_START);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('bookings')) {
            return;
        }

        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('DROP INDEX IF EXISTS '.self::BOOKINGS_STAFF_STATUS_START);

            return;
        }

        if ($this->indexExists('bookings', self::BOOKINGS_STAFF_STATUS_START)) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->dropIndex(self::BOOKINGS_STAFF_STATUS_START);
            });
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
