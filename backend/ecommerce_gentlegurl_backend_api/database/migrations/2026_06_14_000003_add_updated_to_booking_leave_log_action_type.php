<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE booking_leave_logs DROP CONSTRAINT IF EXISTS booking_leave_logs_action_type_check");
            DB::statement("ALTER TABLE booking_leave_logs ADD CONSTRAINT booking_leave_logs_action_type_check CHECK (action_type IN ('created','approved','rejected','cancelled','adjusted','updated'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_logs MODIFY action_type ENUM('created','approved','rejected','cancelled','adjusted','updated') NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE booking_leave_logs DROP CONSTRAINT IF EXISTS booking_leave_logs_action_type_check");
            DB::statement("ALTER TABLE booking_leave_logs ADD CONSTRAINT booking_leave_logs_action_type_check CHECK (action_type IN ('created','approved','rejected','cancelled','adjusted'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_logs MODIFY action_type ENUM('created','approved','rejected','cancelled','adjusted') NOT NULL");
        }
    }
};
