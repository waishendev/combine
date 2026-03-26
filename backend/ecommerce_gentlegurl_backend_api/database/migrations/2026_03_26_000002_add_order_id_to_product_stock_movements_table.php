<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('product_stock_movements')) {
            return;
        }

        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('product_stock_movements', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('product_variant_id')->constrained('orders')->nullOnDelete();
                $table->index('order_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_stock_movements')) {
            return;
        }

        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('product_stock_movements', 'order_id')) {
                $table->dropIndex(['order_id']);
                $table->dropConstrainedForeignId('order_id');
            }
        });
    }
};
