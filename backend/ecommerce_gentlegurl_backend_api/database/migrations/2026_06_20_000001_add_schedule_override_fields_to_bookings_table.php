<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->boolean('schedule_override_used')->default(false)->after('reschedule_reason');
            $table->string('schedule_override_type')->nullable()->after('schedule_override_used');
            $table->dateTime('scheduled_staff_start_at')->nullable()->after('schedule_override_type');
            $table->dateTime('scheduled_staff_end_at')->nullable()->after('scheduled_staff_start_at');
            $table->dateTime('actual_booking_start_at')->nullable()->after('scheduled_staff_end_at');
            $table->dateTime('actual_booking_end_at')->nullable()->after('actual_booking_start_at');
            $table->unsignedBigInteger('schedule_override_by')->nullable()->after('actual_booking_end_at');
            $table->dateTime('schedule_override_at')->nullable()->after('schedule_override_by');
            $table->index(['schedule_override_used', 'schedule_override_at'], 'bookings_schedule_override_idx');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_schedule_override_idx');
            $table->dropColumn([
                'schedule_override_used',
                'schedule_override_type',
                'scheduled_staff_start_at',
                'scheduled_staff_end_at',
                'actual_booking_start_at',
                'actual_booking_end_at',
                'schedule_override_by',
                'schedule_override_at',
            ]);
        });
    }
};
