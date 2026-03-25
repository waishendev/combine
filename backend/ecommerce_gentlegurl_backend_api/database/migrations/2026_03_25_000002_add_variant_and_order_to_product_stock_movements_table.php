<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('product_stock_movements', 'product_variant_id')) {
                $table->foreignId('product_variant_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('product_variants')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('product_stock_movements', 'order_id')) {
                $table->foreignId('order_id')
                    ->nullable()
                    ->after('product_variant_id')
                    ->constrained('orders')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('product_stock_movements', 'order_id')) {
                $table->dropForeign(['order_id']);
                $table->dropColumn('order_id');
            }

            if (Schema::hasColumn('product_stock_movements', 'product_variant_id')) {
                $table->dropForeign(['product_variant_id']);
                $table->dropColumn('product_variant_id');
            }
        });
    }
};
