<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'is_hidden_in_shop')) {
                $table->boolean('is_hidden_in_shop')->default(false)->after('is_featured');
            }

            if (! Schema::hasColumn('products', 'is_staff_free')) {
                $table->boolean('is_staff_free')->default(false)->after('is_hidden_in_shop');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'unit_price_snapshot')) {
                $table->decimal('unit_price_snapshot', 12, 2)->nullable()->after('price_snapshot');
            }

            if (! Schema::hasColumn('order_items', 'line_total_snapshot')) {
                $table->decimal('line_total_snapshot', 12, 2)->nullable()->after('line_total');
            }

            if (! Schema::hasColumn('order_items', 'effective_unit_price')) {
                $table->decimal('effective_unit_price', 12, 2)->nullable()->after('unit_price_snapshot');
            }

            if (! Schema::hasColumn('order_items', 'effective_line_total')) {
                $table->decimal('effective_line_total', 12, 2)->nullable()->after('line_total_snapshot');
            }

            if (! Schema::hasColumn('order_items', 'is_staff_free_applied')) {
                $table->boolean('is_staff_free_applied')->default(false)->after('effective_line_total');
            }
        });

        DB::table('order_items')->update([
            'unit_price_snapshot' => DB::raw('COALESCE(unit_price_snapshot, price_snapshot)'),
            'line_total_snapshot' => DB::raw('COALESCE(line_total_snapshot, line_total)'),
        ]);

        DB::table('order_items')->update([
            'effective_unit_price' => DB::raw('COALESCE(effective_unit_price, unit_price_snapshot, price_snapshot)'),
            'effective_line_total' => DB::raw('COALESCE(effective_line_total, line_total_snapshot, line_total)'),
            'is_staff_free_applied' => false,
        ]);
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'is_staff_free_applied')) {
                $table->dropColumn('is_staff_free_applied');
            }

            if (Schema::hasColumn('order_items', 'effective_line_total')) {
                $table->dropColumn('effective_line_total');
            }

            if (Schema::hasColumn('order_items', 'effective_unit_price')) {
                $table->dropColumn('effective_unit_price');
            }

            if (Schema::hasColumn('order_items', 'line_total_snapshot')) {
                $table->dropColumn('line_total_snapshot');
            }

            if (Schema::hasColumn('order_items', 'unit_price_snapshot')) {
                $table->dropColumn('unit_price_snapshot');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'is_staff_free')) {
                $table->dropColumn('is_staff_free');
            }

            if (Schema::hasColumn('products', 'is_hidden_in_shop')) {
                $table->dropColumn('is_hidden_in_shop');
            }
        });
    }
};
