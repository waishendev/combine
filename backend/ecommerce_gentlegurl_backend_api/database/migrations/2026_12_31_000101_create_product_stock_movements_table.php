<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_stock_movements', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('type', 20);
            $table->integer('quantity_before');
            $table->integer('quantity_change');
            $table->integer('quantity_after');
            $table->decimal('cost_price_before', 12, 2)->default(0);
            $table->decimal('cost_price_after', 12, 2)->default(0);
            $table->decimal('inventory_value_before', 12, 2)->default(0);
            $table->decimal('inventory_value_after', 12, 2)->default(0);
            $table->decimal('input_cost_price_per_unit', 12, 2)->nullable();
            $table->text('remark')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_stock_movements');
    }
};
