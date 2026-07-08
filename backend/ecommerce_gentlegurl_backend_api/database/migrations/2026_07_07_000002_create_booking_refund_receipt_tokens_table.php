<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_refund_receipt_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_refund_id')->constrained('booking_refunds')->cascadeOnDelete();
            $table->string('token', 128)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_refund_receipt_tokens');
    }
};
