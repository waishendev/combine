<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique('staff_user_id');
        });

        Schema::create('pos_cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_cart_id')->constrained('pos_carts')->cascadeOnDelete();
            $table->unsignedBigInteger('variant_id');
            $table->index('variant_id');
            $table->unsignedInteger('qty')->default(1);
            $table->decimal('price_snapshot', 12, 2);
            $table->timestamps();

            $table->unique(['pos_cart_id', 'variant_id']);
        });

        Schema::create('order_receipt_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('token', 128)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_receipt_tokens');
        Schema::dropIfExists('pos_cart_items');
        Schema::dropIfExists('pos_carts');
    }
};
