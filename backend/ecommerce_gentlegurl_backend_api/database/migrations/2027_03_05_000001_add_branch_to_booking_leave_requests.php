<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('staff_id')
                ->constrained('store_locations')->nullOnDelete();
            $table->index(['store_location_id', 'start_date', 'end_date'], 'leave_branch_dates_idx');
        });
    }

    public function down(): void
    {
        Schema::table('booking_leave_requests', function (Blueprint $table) {
            $table->dropIndex('leave_branch_dates_idx');
            $table->dropConstrainedForeignId('store_location_id');
        });
    }
};
