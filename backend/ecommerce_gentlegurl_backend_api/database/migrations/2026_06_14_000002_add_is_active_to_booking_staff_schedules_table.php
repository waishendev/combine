<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_staff_schedules', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('break_end');
            $table->index(['staff_id', 'day_of_week', 'is_active'], 'booking_staff_schedules_staff_day_active_idx');
        });
    }

    public function down(): void
    {
        Schema::table('booking_staff_schedules', function (Blueprint $table) {
            $table->dropIndex('booking_staff_schedules_staff_day_active_idx');
            $table->dropColumn('is_active');
        });
    }
};
