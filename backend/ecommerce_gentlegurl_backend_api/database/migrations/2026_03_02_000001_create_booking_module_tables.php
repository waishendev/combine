<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_services', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('duration_min');
            $table->decimal('deposit_amount', 12, 2)->default(0);
            $table->unsignedInteger('buffer_min')->default(15);
            $table->boolean('is_active')->default(true);
            $table->json('rules_json')->nullable();
            $table->timestamps();

            $table->index('is_active');
        });

        Schema::create('booking_service_staff', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['service_id', 'staff_id']);
        });

        Schema::create('booking_staff_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->time('break_start')->nullable();
            $table->time('break_end')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'day_of_week']);
        });

        Schema::create('booking_staff_timeoffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'start_at']);
        });

        Schema::create('booking_blocks', function (Blueprint $table) {
            $table->id();
            $table->enum('scope', ['STORE', 'STAFF']);
            $table->foreignId('staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->string('reason')->nullable();
            $table->foreignId('created_by_staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->timestamps();

            $table->index(['scope', 'start_at']);
            $table->index(['staff_id', 'start_at']);
        });

        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_code')->nullable()->unique();
            $table->enum('source', ['GUEST', 'CUSTOMER', 'STAFF']);
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('guest_name')->nullable();
            $table->string('guest_phone')->nullable();
            $table->string('guest_email')->nullable();
            $table->foreignId('staff_id')->constrained('staffs');
            $table->foreignId('service_id')->constrained('booking_services');
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->unsignedInteger('buffer_min')->default(15);
            $table->enum('status', ['HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'LATE_CANCELLATION', 'NO_SHOW', 'EXPIRED']);
            $table->decimal('deposit_amount', 12, 2)->default(0);
            $table->enum('payment_status', ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'])->default('UNPAID');
            $table->dateTime('hold_expires_at')->nullable();
            $table->foreignId('created_by_staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->dateTime('cancelled_at')->nullable();
            $table->enum('cancellation_type', ['CANCELLED', 'LATE_CANCELLATION'])->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'start_at']);
            $table->index(['service_id', 'start_at']);
            $table->index(['customer_id', 'start_at']);
            $table->index(['status', 'start_at']);
            $table->index('hold_expires_at');
        });

        Schema::create('booking_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('provider');
            $table->string('ref')->nullable();
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['PENDING', 'PAID', 'FAILED'])->default('PENDING');
            $table->json('raw_response')->nullable();
            $table->timestamps();
        });

        Schema::create('booking_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('url');
            $table->foreignId('uploaded_by_staff_id')->constrained('staffs');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('booking_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->enum('actor_type', ['STAFF', 'ADMIN', 'SYSTEM']);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('action');
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_logs');
        Schema::dropIfExists('booking_photos');
        Schema::dropIfExists('booking_payments');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('booking_blocks');
        Schema::dropIfExists('booking_staff_timeoffs');
        Schema::dropIfExists('booking_staff_schedules');
        Schema::dropIfExists('booking_service_staff');
        Schema::dropIfExists('booking_services');
    }
};
