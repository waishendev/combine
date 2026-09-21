<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('booking_leave_logs', 'store_location_id')) {
            Schema::table('booking_leave_logs', function (Blueprint $table) {
                $table->foreignId('store_location_id')
                    ->nullable()
                    ->after('staff_id')
                    ->constrained('store_locations')
                    ->nullOnDelete();
            });
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE booking_leave_logs DROP CONSTRAINT IF EXISTS booking_leave_logs_action_type_check');
            DB::statement("ALTER TABLE booking_leave_logs ADD CONSTRAINT booking_leave_logs_action_type_check CHECK (action_type IN ('created','approved','rejected','cancelled','adjusted','updated','generated'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_logs MODIFY action_type ENUM('created','approved','rejected','cancelled','adjusted','updated','generated') NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE booking_leave_logs DROP CONSTRAINT IF EXISTS booking_leave_logs_action_type_check');
            DB::statement("ALTER TABLE booking_leave_logs ADD CONSTRAINT booking_leave_logs_action_type_check CHECK (action_type IN ('created','approved','rejected','cancelled','adjusted','updated'))");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_logs MODIFY action_type ENUM('created','approved','rejected','cancelled','adjusted','updated') NOT NULL");
        }

        if (Schema::hasColumn('booking_leave_logs', 'store_location_id')) {
            Schema::table('booking_leave_logs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('store_location_id');
            });
        }
    }
};
