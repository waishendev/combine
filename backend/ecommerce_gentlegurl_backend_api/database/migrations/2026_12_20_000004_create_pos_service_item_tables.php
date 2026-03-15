<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pos_cart_service_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_cart_id')->constrained('pos_carts')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->string('service_name_snapshot');
            $table->decimal('price_snapshot', 10, 2);
            $table->unsignedInteger('qty')->default(1);
            $table->foreignId('assigned_staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->decimal('commission_rate_used', 6, 4)->default(0);
            $table->timestamps();
        });

        Schema::create('order_service_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->string('service_name_snapshot');
            $table->decimal('price_snapshot', 10, 2);
            $table->unsignedInteger('qty')->default(1);
            $table->decimal('line_total', 10, 2);
            $table->foreignId('assigned_staff_id')->nullable()->constrained('staffs')->nullOnDelete();
            $table->decimal('commission_rate_used', 6, 4)->default(0);
            $table->decimal('commission_amount', 10, 2)->default(0);
            $table->enum('item_type', ['service'])->default('service');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_service_items');
        Schema::dropIfExists('pos_cart_service_items');
    }
};
