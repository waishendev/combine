<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_cart_appointment_settlement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_cart_id')->constrained('pos_carts')->cascadeOnDelete();
            $table->unsignedBigInteger('booking_id');
            $table->timestamps();

            $table->index('booking_id');
            $table->unique(['pos_cart_id', 'booking_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_cart_appointment_settlement_items');
    }
};

