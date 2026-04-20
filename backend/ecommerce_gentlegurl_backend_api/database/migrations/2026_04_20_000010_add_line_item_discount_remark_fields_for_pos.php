<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_cart_items', 'discount_remark')) {
                $table->string('discount_remark', 255)->nullable()->after('discount_value');
            }
        });

        Schema::table('pos_cart_package_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_cart_package_items', 'discount_type')) {
                $table->string('discount_type')->nullable()->after('staff_splits');
            }
            if (!Schema::hasColumn('pos_cart_package_items', 'discount_value')) {
                $table->decimal('discount_value', 12, 2)->default(0)->after('discount_type');
            }
            if (!Schema::hasColumn('pos_cart_package_items', 'discount_remark')) {
                $table->string('discount_remark', 255)->nullable()->after('discount_value');
            }
        });

        Schema::table('pos_cart_appointment_settlement_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_cart_appointment_settlement_items', 'discount_type')) {
                $table->string('discount_type')->nullable()->after('booking_id');
            }
            if (!Schema::hasColumn('pos_cart_appointment_settlement_items', 'discount_value')) {
                $table->decimal('discount_value', 12, 2)->default(0)->after('discount_type');
            }
            if (!Schema::hasColumn('pos_cart_appointment_settlement_items', 'discount_remark')) {
                $table->string('discount_remark', 255)->nullable()->after('discount_value');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'discount_remark')) {
                $table->string('discount_remark', 255)->nullable()->after('discount_value');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'discount_remark')) {
                $table->dropColumn('discount_remark');
            }
        });

        Schema::table('pos_cart_appointment_settlement_items', function (Blueprint $table) {
            foreach (['discount_remark', 'discount_value', 'discount_type'] as $column) {
                if (Schema::hasColumn('pos_cart_appointment_settlement_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('pos_cart_package_items', function (Blueprint $table) {
            foreach (['discount_remark', 'discount_value', 'discount_type'] as $column) {
                if (Schema::hasColumn('pos_cart_package_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_items', 'discount_remark')) {
                $table->dropColumn('discount_remark');
            }
        });
    }
};
