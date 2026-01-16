<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'product_variant_id')) {
                $table->foreignId('product_variant_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('product_variants')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('order_items', 'variant_name_snapshot')) {
                $table->string('variant_name_snapshot', 255)->nullable()->after('sku_snapshot');
            }
            if (! Schema::hasColumn('order_items', 'variant_sku_snapshot')) {
                $table->string('variant_sku_snapshot', 100)->nullable()->after('variant_name_snapshot');
            }
            if (! Schema::hasColumn('order_items', 'variant_price_snapshot')) {
                $table->decimal('variant_price_snapshot', 12, 2)->nullable()->after('price_snapshot');
            }
            if (! Schema::hasColumn('order_items', 'variant_cost_snapshot')) {
                $table->decimal('variant_cost_snapshot', 12, 2)->nullable()->after('variant_price_snapshot');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'product_variant_id')) {
                $table->dropForeign(['product_variant_id']);
                $table->dropColumn('product_variant_id');
            }
            if (Schema::hasColumn('order_items', 'variant_name_snapshot')) {
                $table->dropColumn('variant_name_snapshot');
            }
            if (Schema::hasColumn('order_items', 'variant_sku_snapshot')) {
                $table->dropColumn('variant_sku_snapshot');
            }
            if (Schema::hasColumn('order_items', 'variant_price_snapshot')) {
                $table->dropColumn('variant_price_snapshot');
            }
            if (Schema::hasColumn('order_items', 'variant_cost_snapshot')) {
                $table->dropColumn('variant_cost_snapshot');
            }
        });
    }
};
