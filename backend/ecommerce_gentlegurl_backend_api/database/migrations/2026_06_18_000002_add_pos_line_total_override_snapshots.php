<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['pos_cart_items', 'pos_cart_package_items'] as $tableName) {
            if (! Schema::hasTable($tableName)) continue;
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'price_override_line_total')) {
                    $table->decimal('price_override_line_total', 12, 2)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['pos_cart_items', 'pos_cart_package_items'] as $tableName) {
            if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'price_override_line_total')) continue;
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('price_override_line_total');
            });
        }
    }
};
