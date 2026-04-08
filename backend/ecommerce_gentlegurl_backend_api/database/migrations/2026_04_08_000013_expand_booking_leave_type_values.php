<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE booking_leave_balances DROP CONSTRAINT IF EXISTS booking_leave_balances_leave_type_check");
            DB::statement("ALTER TABLE booking_leave_balances ADD CONSTRAINT booking_leave_balances_leave_type_check CHECK (leave_type IN ('annual','mc','emergency','unpaid','off_day'))");

            DB::statement("ALTER TABLE booking_leave_requests DROP CONSTRAINT IF EXISTS booking_leave_requests_leave_type_check");
            DB::statement("ALTER TABLE booking_leave_requests ADD CONSTRAINT booking_leave_requests_leave_type_check CHECK (leave_type IN ('annual','mc','emergency','unpaid','off_day'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_balances MODIFY leave_type ENUM('annual','mc','emergency','unpaid','off_day') NOT NULL");
            DB::statement("ALTER TABLE booking_leave_requests MODIFY leave_type ENUM('annual','mc','emergency','unpaid','off_day') NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE booking_leave_balances DROP CONSTRAINT IF EXISTS booking_leave_balances_leave_type_check");
            DB::statement("ALTER TABLE booking_leave_balances ADD CONSTRAINT booking_leave_balances_leave_type_check CHECK (leave_type IN ('annual','mc','off_day'))");

            DB::statement("ALTER TABLE booking_leave_requests DROP CONSTRAINT IF EXISTS booking_leave_requests_leave_type_check");
            DB::statement("ALTER TABLE booking_leave_requests ADD CONSTRAINT booking_leave_requests_leave_type_check CHECK (leave_type IN ('annual','mc','off_day'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE booking_leave_balances MODIFY leave_type ENUM('annual','mc','off_day') NOT NULL");
            DB::statement("ALTER TABLE booking_leave_requests MODIFY leave_type ENUM('annual','mc','off_day') NOT NULL");
        }
    }
};
