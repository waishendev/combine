<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('deposit_amount_per_premium', 12, 2)->default(30);
            $table->decimal('deposit_base_amount_if_only_standard', 12, 2)->default(30);
            $table->unsignedInteger('cart_hold_minutes')->default(15);
            $table->timestamps();
        });

        Schema::create('booking_carts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('guest_token')->nullable();
            $table->enum('status', ['active', 'converted', 'expired'])->default('active');
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index(['guest_token', 'status']);
        });

        Schema::create('booking_cart_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('booking_cart_id');
            $table->foreign('booking_cart_id')->references('id')->on('booking_carts')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->enum('service_type', ['premium', 'standard']);
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->dateTime('expires_at');
            $table->enum('status', ['active', 'expired', 'removed', 'converted'])->default('active');
            $table->timestamps();

            $table->index(['booking_cart_id', 'status']);
            $table->index(['staff_id', 'start_at']);
            $table->index('expires_at');
        });

        DB::table('booking_settings')->insert([
            'deposit_amount_per_premium' => 30,
            'deposit_base_amount_if_only_standard' => 30,
            'cart_hold_minutes' => 15,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_cart_items');
        Schema::dropIfExists('booking_carts');
        Schema::dropIfExists('booking_settings');
    }
};
