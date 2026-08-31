<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Activity logs query enhancement — P1 indexes.
 * Pages: CRM /activity-logs (+ appointment activity logs share table).
 *
 * Enhancement id: activity-logs-landing-page-query-v1
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (! Schema::hasTable('activity_logs')) {
            return;
        }

        DB::statement('CREATE INDEX IF NOT EXISTS activity_logs_action_created_at_desc_idx ON activity_logs (action, created_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS activity_logs_action_model_type_idx ON activity_logs (action, model_type)');
        DB::statement('CREATE INDEX IF NOT EXISTS activity_logs_action_user_id_idx ON activity_logs (action, user_id)');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS activity_logs_action_created_at_desc_idx');
        DB::statement('DROP INDEX IF EXISTS activity_logs_action_model_type_idx');
        DB::statement('DROP INDEX IF EXISTS activity_logs_action_user_id_idx');
    }
};
