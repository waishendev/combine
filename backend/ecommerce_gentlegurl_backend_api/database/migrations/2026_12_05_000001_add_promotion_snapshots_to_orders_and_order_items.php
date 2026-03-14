<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'promotion_snapshot')) {
                $table->json('promotion_snapshot')->nullable()->after('voucher_code_snapshot');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'promotion_snapshot')) {
                $table->json('promotion_snapshot')->nullable()->after('promotion_applied');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'promotion_snapshot')) {
                $table->dropColumn('promotion_snapshot');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'promotion_snapshot')) {
                $table->dropColumn('promotion_snapshot');
            }
        });
    }
};
