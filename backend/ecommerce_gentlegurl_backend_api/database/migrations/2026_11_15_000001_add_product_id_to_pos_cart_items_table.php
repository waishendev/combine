<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cart_items', 'product_id')) {
                $table->foreignId('product_id')
                    ->nullable()
                    ->after('pos_cart_id')
                    ->constrained('products')
                    ->nullOnDelete();

                $table->unique(['pos_cart_id', 'product_id'], 'pos_cart_items_cart_product_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_items', 'product_id')) {
                $table->dropUnique('pos_cart_items_cart_product_unique');
                $table->dropForeign(['product_id']);
                $table->dropColumn('product_id');
            }
        });
    }
};
