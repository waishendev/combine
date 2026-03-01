<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'reschedule_count')) {
                $table->unsignedInteger('reschedule_count')->default(0)->after('notes');
            }
            if (!Schema::hasColumn('bookings', 'rescheduled_at')) {
                $table->dateTime('rescheduled_at')->nullable()->after('reschedule_count');
            }
            if (!Schema::hasColumn('bookings', 'rescheduled_from_booking_id')) {
                $table->unsignedBigInteger('rescheduled_from_booking_id')->nullable()->after('rescheduled_at');
            }
            if (!Schema::hasColumn('bookings', 'reschedule_reason')) {
                $table->text('reschedule_reason')->nullable()->after('rescheduled_from_booking_id');
            }
            if (!Schema::hasColumn('bookings', 'notified_cancellation_voucher_id')) {
                $table->foreignId('notified_cancellation_voucher_id')->nullable()->after('reschedule_reason')->constrained('vouchers')->nullOnDelete();
            }
        });

        DB::statement("ALTER TABLE bookings MODIFY COLUMN status ENUM('HOLD','CONFIRMED','COMPLETED','CANCELLED','LATE_CANCELLATION','NO_SHOW','NOTIFIED_CANCELLATION','EXPIRED')");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE bookings MODIFY COLUMN status ENUM('HOLD','CONFIRMED','COMPLETED','CANCELLED','LATE_CANCELLATION','NO_SHOW','EXPIRED')");

        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'notified_cancellation_voucher_id')) {
                $table->dropConstrainedForeignId('notified_cancellation_voucher_id');
            }
            $table->dropColumn(['reschedule_count', 'rescheduled_at', 'rescheduled_from_booking_id', 'reschedule_reason']);
        });
    }
};
