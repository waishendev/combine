<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * booking-services-crm-query-v1 — list/options indexes.
 */
return new class extends Migration
{
    private const CATEGORY_SERVICE_REVERSE = 'booking_service_category_service_service_id_idx';

    private const SERVICES_CREATED = 'booking_services_created_at_desc_idx';

    private const SERVICES_ACTIVE_CREATED = 'booking_services_is_active_created_at_desc_idx';

    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if (Schema::hasTable('booking_service_category_service')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::CATEGORY_SERVICE_REVERSE
                    .' ON booking_service_category_service (booking_service_id, booking_service_category_id)'
                );
            } elseif (! $this->indexExists('booking_service_category_service', self::CATEGORY_SERVICE_REVERSE)) {
                Schema::table('booking_service_category_service', function (Blueprint $table) {
                    $table->index(
                        ['booking_service_id', 'booking_service_category_id'],
                        self::CATEGORY_SERVICE_REVERSE
                    );
                });
            }
        }

        if (Schema::hasTable('booking_services')) {
            if ($pgsql) {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::SERVICES_CREATED
                    .' ON booking_services (created_at DESC)'
                );
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS '.self::SERVICES_ACTIVE_CREATED
                    .' ON booking_services (is_active, created_at DESC)'
                );
            } else {
                Schema::table('booking_services', function (Blueprint $table) {
                    if (! $this->indexExists('booking_services', self::SERVICES_CREATED)) {
                        $table->index(['created_at'], self::SERVICES_CREATED);
                    }
                    if (! $this->indexExists('booking_services', self::SERVICES_ACTIVE_CREATED)) {
                        $table->index(['is_active', 'created_at'], self::SERVICES_ACTIVE_CREATED);
                    }
                });
            }
        }
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('DROP INDEX IF EXISTS '.self::CATEGORY_SERVICE_REVERSE);
            DB::statement('DROP INDEX IF EXISTS '.self::SERVICES_CREATED);
            DB::statement('DROP INDEX IF EXISTS '.self::SERVICES_ACTIVE_CREATED);

            return;
        }

        if (Schema::hasTable('booking_service_category_service')
            && $this->indexExists('booking_service_category_service', self::CATEGORY_SERVICE_REVERSE)) {
            Schema::table('booking_service_category_service', function (Blueprint $table) {
                $table->dropIndex(self::CATEGORY_SERVICE_REVERSE);
            });
        }

        if (Schema::hasTable('booking_services')) {
            Schema::table('booking_services', function (Blueprint $table) {
                if ($this->indexExists('booking_services', self::SERVICES_CREATED)) {
                    $table->dropIndex(self::SERVICES_CREATED);
                }
                if ($this->indexExists('booking_services', self::SERVICES_ACTIVE_CREATED)) {
                    $table->dropIndex(self::SERVICES_ACTIVE_CREATED);
                }
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
