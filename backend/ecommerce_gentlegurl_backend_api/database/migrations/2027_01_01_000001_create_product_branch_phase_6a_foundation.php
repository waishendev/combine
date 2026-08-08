<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_location_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_available')->default(true);
            $table->timestamps();
            $table->unique(['store_location_id', 'product_id']);
        });

        Schema::create('store_location_product_inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->cascadeOnDelete();
            // Zero represents the product-level row. A non-zero value must mirror product_variant_id.
            // Unlike a nullable composite unique key, this also prevents duplicate non-variant rows.
            $table->unsignedBigInteger('variant_identity')->virtualAs('coalesce(product_variant_id, 0)');
            $table->integer('quantity')->default(0);
            $table->timestamps();
            $table->unique(['store_location_id', 'product_id', 'variant_identity'], 'slpi_branch_product_variant_unique');
            $table->index(['product_id', 'product_variant_id']);
        });

        Schema::table('pos_carts', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('staff_user_id')
                ->constrained()->nullOnDelete();
            $table->index(['store_location_id', 'staff_user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_location_id');
        });
        Schema::dropIfExists('store_location_product_inventories');
        Schema::dropIfExists('store_location_product');
    }
};
