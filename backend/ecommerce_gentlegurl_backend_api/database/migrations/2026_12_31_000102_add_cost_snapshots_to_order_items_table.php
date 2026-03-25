<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'cost_price_snapshot')) {
                $table->decimal('cost_price_snapshot', 12, 2)->nullable()->after('variant_cost_snapshot');
            }

            if (! Schema::hasColumn('order_items', 'cost_amount_snapshot')) {
                $table->decimal('cost_amount_snapshot', 12, 2)->nullable()->after('cost_price_snapshot');
            }
        });

        DB::table('order_items')->update([
            'cost_price_snapshot' => DB::raw('COALESCE(cost_price_snapshot, variant_cost_snapshot, 0)'),
            'cost_amount_snapshot' => DB::raw('COALESCE(cost_amount_snapshot, COALESCE(variant_cost_snapshot, 0) * quantity)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'cost_amount_snapshot')) {
                $table->dropColumn('cost_amount_snapshot');
            }

            if (Schema::hasColumn('order_items', 'cost_price_snapshot')) {
                $table->dropColumn('cost_price_snapshot');
            }
        });
    }
};
