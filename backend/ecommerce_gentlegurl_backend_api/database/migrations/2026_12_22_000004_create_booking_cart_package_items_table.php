<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_cart_package_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('booking_cart_id');
            $table->foreign('booking_cart_id')->references('id')->on('booking_carts')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->string('package_name_snapshot');
            $table->decimal('price_snapshot', 12, 2)->default(0);
            $table->unsignedInteger('qty')->default(1);
            $table->enum('status', ['active', 'removed', 'converted'])->default('active');
            $table->timestamps();

            $table->index(['booking_cart_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_cart_package_items');
    }
};
