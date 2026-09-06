<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private const BRANCH_STATUS_CREATED_INDEX = 'leave_requests_branch_status_created_at_desc_idx';

    public function up(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('staff_id')
                ->constrained('store_locations')->nullOnDelete();
            $table->index(['store_location_id', 'start_date', 'end_date'], 'leave_branch_dates_idx');

            if (Schema::getConnection()->getDriverName() !== 'pgsql') {
                $table->index(['store_location_id', 'status', 'created_at'], self::BRANCH_STATUS_CREATED_INDEX);
            }
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement(
                'CREATE INDEX '.self::BRANCH_STATUS_CREATED_INDEX
                .' ON booking_leave_requests (store_location_id, status, created_at DESC)'
            );
        }
    }

    public function down(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            $table->dropIndex(self::BRANCH_STATUS_CREATED_INDEX);
            $table->dropIndex('leave_branch_dates_idx');
            $table->dropConstrainedForeignId('store_location_id');
        });
    }
};
