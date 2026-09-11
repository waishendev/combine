<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('fulfillment_store_location_id')->nullable()->after('order_id')
                ->constrained('store_locations')->nullOnDelete();
            $table->index(['fulfillment_store_location_id', 'order_id'], 'order_items_fulfillment_order_idx');
        });

        Schema::create('ecommerce_order_fulfillments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained('store_locations')->restrictOnDelete();
            $table->string('status', 30)->default('pending');
            $table->timestamps();
            $table->unique(['order_id', 'store_location_id']);
            $table->index(['store_location_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ecommerce_order_fulfillments');
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['fulfillment_store_location_id']);
            $table->dropIndex('order_items_fulfillment_order_idx');
            $table->dropColumn('fulfillment_store_location_id');
        });
    }
};
