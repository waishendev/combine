<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_leave_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->enum('leave_type', ['annual', 'mc', 'emergency', 'unpaid', 'off_day']);
            $table->decimal('entitled_days', 6, 2)->default(0);
            $table->timestamps();

            $table->unique(['staff_id', 'leave_type']);
        });

        Schema::create('booking_leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->enum('leave_type', ['annual', 'mc', 'emergency', 'unpaid', 'off_day']);
            $table->enum('day_type', ['full_day', 'half_day_am', 'half_day_pm'])->default('full_day');
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('days', 6, 2);
            $table->string('reason')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->text('admin_remark')->nullable();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('approved_timeoff_id')->nullable()->constrained('booking_staff_timeoffs')->nullOnDelete();
            $table->timestamps();

            $table->index(['staff_id', 'status']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_leave_requests');
        Schema::dropIfExists('booking_leave_balances');
    }
};
