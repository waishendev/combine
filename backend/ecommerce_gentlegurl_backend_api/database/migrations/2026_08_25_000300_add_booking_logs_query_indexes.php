<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Booking logs query enhancement — P0 indexes.
 * Page: CRM /booking/logs
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (! Schema::hasTable('booking_logs')) {
            return;
        }

        DB::statement('CREATE INDEX IF NOT EXISTS booking_logs_created_at_id_desc_idx ON booking_logs (created_at DESC, id DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS booking_logs_action_created_at_desc_idx ON booking_logs (action, created_at DESC, id DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS booking_logs_booking_id_created_at_desc_idx ON booking_logs (booking_id, created_at DESC) WHERE booking_id IS NOT NULL');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS booking_logs_created_at_id_desc_idx');
        DB::statement('DROP INDEX IF EXISTS booking_logs_action_created_at_desc_idx');
        DB::statement('DROP INDEX IF EXISTS booking_logs_booking_id_created_at_desc_idx');
    }
};
