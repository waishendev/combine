<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_payment_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->string('token', 80)->unique();
            $table->enum('purpose', ['DEPOSIT'])->default('DEPOSIT');
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED'])->default('PENDING');

            // Payment attempt / gateway details (chosen by the payer, not the staff).
            $table->string('provider')->nullable();
            $table->string('payment_ref')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('booking_payment_id')->nullable();

            // Manual transfer review flow.
            $table->string('manual_slip_path')->nullable();
            $table->string('manual_slip_url')->nullable();
            $table->string('manual_review_status')->nullable();

            // Payer identity is independent of the appointment owner.
            $table->unsignedBigInteger('payer_customer_id')->nullable();
            $table->string('payer_name')->nullable();
            $table->string('payer_phone')->nullable();
            $table->string('payer_email')->nullable();

            $table->dateTime('paid_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index('status');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_payment_links');
    }
};
