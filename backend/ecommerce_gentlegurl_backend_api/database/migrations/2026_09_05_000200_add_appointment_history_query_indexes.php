<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * appointment-history-query-v1 — list sort/filter + staff-split lookup indexes.
 */
return new class extends Migration
{
    private const BOOKINGS_CREATED_INDEX = 'bookings_store_created_id_history_index';

    private const SPLITS_BOOKING_INDEX = 'booking_service_staff_splits_booking_id_index';

    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('bookings') && Schema::hasColumns('bookings', ['store_location_id', 'created_at', 'id'])) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::BOOKINGS_CREATED_INDEX
                    .' ON bookings (store_location_id, created_at DESC, id DESC)'
                );
            } else {
                Schema::table('bookings', function (Blueprint $table) {
                    if (! $this->indexExists('bookings', self::BOOKINGS_CREATED_INDEX)) {
                        $table->index(['store_location_id', 'created_at', 'id'], self::BOOKINGS_CREATED_INDEX);
                    }
                });
            }
        }

        if (Schema::hasTable('booking_service_staff_splits') && Schema::hasColumn('booking_service_staff_splits', 'booking_id')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::SPLITS_BOOKING_INDEX
                    .' ON booking_service_staff_splits (booking_id)'
                );
            } else {
                Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                    if (! $this->indexExists('booking_service_staff_splits', self::SPLITS_BOOKING_INDEX)) {
                        $table->index(['booking_id'], self::SPLITS_BOOKING_INDEX);
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('booking_service_staff_splits')) {
            if ($pgsql) {
                DB::statement('DROP INDEX IF EXISTS '.self::SPLITS_BOOKING_INDEX);
            } else {
                Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                    if ($this->indexExists('booking_service_staff_splits', self::SPLITS_BOOKING_INDEX)) {
                        $table->dropIndex(self::SPLITS_BOOKING_INDEX);
                    }
                });
            }
        }

        if (Schema::hasTable('bookings')) {
            if ($pgsql) {
                DB::statement('DROP INDEX IF EXISTS '.self::BOOKINGS_CREATED_INDEX);
            } else {
                Schema::table('bookings', function (Blueprint $table) {
                    if ($this->indexExists('bookings', self::BOOKINGS_CREATED_INDEX)) {
                        $table->dropIndex(self::BOOKINGS_CREATED_INDEX);
                    }
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
        $row = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$dbName, $table, $index]
        );

        return (bool) $row;
    }
};
