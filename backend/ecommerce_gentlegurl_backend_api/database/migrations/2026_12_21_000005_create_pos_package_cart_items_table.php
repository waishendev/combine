<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_cart_package_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_cart_id')->constrained('pos_carts')->cascadeOnDelete();
            $table->foreignId('service_package_id')->constrained('service_packages')->cascadeOnDelete();
            $table->string('package_name_snapshot');
            $table->decimal('price_snapshot', 10, 2)->default(0);
            $table->unsignedInteger('qty')->default(1);
            $table->timestamps();

            $table->unique(['pos_cart_id', 'service_package_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_cart_package_items');
    }
};
