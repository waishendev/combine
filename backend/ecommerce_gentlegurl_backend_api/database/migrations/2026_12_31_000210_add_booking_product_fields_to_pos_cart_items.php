<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cart_items', 'item_type')) {
                $table->string('item_type', 40)->default('product')->after('pos_cart_id');
            }
            if (! Schema::hasColumn('pos_cart_items', 'booking_product_id')) {
                $table->foreignId('booking_product_id')->nullable()->after('product_id')->constrained('booking_products')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_items', 'booking_product_id')) {
                $table->dropConstrainedForeignId('booking_product_id');
            }
            if (Schema::hasColumn('pos_cart_items', 'item_type')) {
                $table->dropColumn('item_type');
            }
        });
    }
};

