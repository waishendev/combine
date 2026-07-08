<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('refund_no')->unique();
            $table->decimal('amount', 10, 2);
            $table->string('method', 50);
            $table->string('channel', 20)->default('offline');
            $table->string('reason')->nullable();
            $table->string('status', 20)->default('completed');
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->text('remark')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index(['method', 'channel']);
            $table->index('processed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_refunds');
    }
};
