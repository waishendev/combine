<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('branch_notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->unique()->constrained('store_locations')->restrictOnDelete();
            $table->boolean('booking_reminder_enabled')->default(true);
            $table->time('booking_reminder_send_at')->default('10:00');
            $table->boolean('booking_feedback_enabled')->default(true);
            $table->time('booking_feedback_send_at')->default('10:00');
            $table->boolean('booking_payment_proof_enabled')->default(true);
            $table->json('booking_payment_proof_recipients')->default('[]');
            $table->boolean('daily_order_summary_enabled')->default(true);
            $table->time('daily_order_summary_send_at')->default('10:00');
            $table->json('daily_order_summary_recipients')->default('[]');
            $table->boolean('daily_low_stock_enabled')->default(true);
            $table->time('daily_low_stock_send_at')->default('10:00');
            $table->json('daily_low_stock_recipients')->default('[]');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_notification_settings');
    }
};
