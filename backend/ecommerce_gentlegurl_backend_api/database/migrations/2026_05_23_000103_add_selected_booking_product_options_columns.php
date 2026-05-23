<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cart_items', 'selected_booking_product_options')) {
                $table->json('selected_booking_product_options')->nullable()->after('price_snapshot');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'selected_booking_product_options')) {
                $table->json('selected_booking_product_options')->nullable()->after('line_total');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'selected_booking_product_options')) {
                $table->dropColumn('selected_booking_product_options');
            }
        });

        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_items', 'selected_booking_product_options')) {
                $table->dropColumn('selected_booking_product_options');
            }
        });
    }
};
