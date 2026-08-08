<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['booking_staff_schedules', 'booking_staff_timeoffs', 'booking_blocks'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->foreignId('store_location_id')->nullable()->after('staff_id')
                    ->constrained('store_locations')->nullOnDelete();
                $timeColumn = $tableName === 'booking_staff_schedules' ? 'start_time' : 'start_at';
                $table->index(['store_location_id', $timeColumn], $tableName.'_store_start_idx');
            });
        }

        Schema::table('booking_staff_schedules', function (Blueprint $table) {
            $table->index(['staff_id', 'day_of_week', 'start_time', 'end_time'], 'staff_schedule_overlap_idx');
        });
    }

    public function down(): void
    {
        Schema::table('booking_staff_schedules', fn (Blueprint $table) => $table->dropIndex('staff_schedule_overlap_idx'));
        foreach (['booking_staff_schedules', 'booking_staff_timeoffs', 'booking_blocks'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropIndex($tableName.'_store_start_idx');
                $table->dropConstrainedForeignId('store_location_id');
            });
        }
    }
};
