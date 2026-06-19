<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['pos_cart_items', 'pos_cart_package_items'] as $tableName) {
            if (Schema::hasTable($tableName) && ! Schema::hasColumn($tableName, 'price_override_snapshot')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->json('price_override_snapshot')->nullable()->after('price_override_line_total');
                });
            }
        }

        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'price_override_snapshot')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->json('price_override_snapshot')->nullable()->after('line_total_after_discount');
            });
        }
    }

    public function down(): void
    {
        foreach (['pos_cart_items', 'pos_cart_package_items', 'order_items'] as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'price_override_snapshot')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('price_override_snapshot');
                });
            }
        }
    }
};
