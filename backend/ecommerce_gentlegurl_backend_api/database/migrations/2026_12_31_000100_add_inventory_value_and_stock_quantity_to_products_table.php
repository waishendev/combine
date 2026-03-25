<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'stock_quantity')) {
                $table->integer('stock_quantity')->default(0)->after('stock');
            }

            if (! Schema::hasColumn('products', 'inventory_value')) {
                $table->decimal('inventory_value', 12, 2)->default(0)->after('cost_price');
            }
        });

        DB::statement('UPDATE products SET stock_quantity = stock WHERE stock_quantity IS NULL OR stock_quantity = 0');
        DB::statement('UPDATE products SET inventory_value = ROUND(COALESCE(stock, 0) * COALESCE(cost_price, 0), 2) WHERE inventory_value IS NULL OR inventory_value = 0');
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'inventory_value')) {
                $table->dropColumn('inventory_value');
            }

            if (Schema::hasColumn('products', 'stock_quantity')) {
                $table->dropColumn('stock_quantity');
            }
        });
    }
};
