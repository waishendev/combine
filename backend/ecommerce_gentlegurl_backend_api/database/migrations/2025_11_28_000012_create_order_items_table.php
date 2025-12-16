<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('product_name_snapshot', 255);
            $table->string('sku_snapshot', 100)->nullable();
            $table->decimal('price_snapshot', 12, 2);
            $table->integer('quantity');
            $table->decimal('line_total', 12, 2);
            $table->boolean('is_package')->default(false);
            $table->foreignId('parent_package_item_id')->nullable()->constrained('order_items')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
