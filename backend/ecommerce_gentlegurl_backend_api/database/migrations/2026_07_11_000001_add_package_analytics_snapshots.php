<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('customer_service_packages')) {
            Schema::table('customer_service_packages', function (Blueprint $table) {
                if (! Schema::hasColumn('customer_service_packages', 'package_name_snapshot')) {
                    $table->string('package_name_snapshot')->nullable()->after('service_package_id');
                }
                if (! Schema::hasColumn('customer_service_packages', 'selling_price_snapshot')) {
                    $table->decimal('selling_price_snapshot', 12, 2)->nullable()->after('package_name_snapshot');
                }
                if (! Schema::hasColumn('customer_service_packages', 'purchase_amount_snapshot')) {
                    $table->decimal('purchase_amount_snapshot', 12, 2)->nullable()->after('selling_price_snapshot');
                }
                if (! Schema::hasColumn('customer_service_packages', 'refunded_amount_snapshot')) {
                    $table->decimal('refunded_amount_snapshot', 12, 2)->nullable()->after('purchase_amount_snapshot');
                }
                if (! Schema::hasColumn('customer_service_packages', 'purchase_reference_snapshot')) {
                    $table->string('purchase_reference_snapshot')->nullable()->after('refunded_amount_snapshot');
                }
            });
        }

        if (Schema::hasTable('customer_service_package_balances')) {
            Schema::table('customer_service_package_balances', function (Blueprint $table) {
                if (! Schema::hasColumn('customer_service_package_balances', 'service_name_snapshot')) {
                    $table->string('service_name_snapshot')->nullable()->after('booking_service_id');
                }
                if (! Schema::hasColumn('customer_service_package_balances', 'redemption_value_snapshot')) {
                    $table->decimal('redemption_value_snapshot', 12, 2)->nullable()->after('remaining_qty');
                }
            });
        }

        if (Schema::hasTable('customer_service_package_usages')) {
            Schema::table('customer_service_package_usages', function (Blueprint $table) {
                if (! Schema::hasColumn('customer_service_package_usages', 'service_name_snapshot')) {
                    $table->string('service_name_snapshot')->nullable()->after('booking_service_id');
                }
                if (! Schema::hasColumn('customer_service_package_usages', 'redemption_value_snapshot')) {
                    $table->decimal('redemption_value_snapshot', 12, 2)->nullable()->after('used_qty');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customer_service_package_usages')) {
            Schema::table('customer_service_package_usages', function (Blueprint $table) {
                foreach (['redemption_value_snapshot', 'service_name_snapshot'] as $column) {
                    if (Schema::hasColumn('customer_service_package_usages', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
        if (Schema::hasTable('customer_service_package_balances')) {
            Schema::table('customer_service_package_balances', function (Blueprint $table) {
                foreach (['redemption_value_snapshot', 'service_name_snapshot'] as $column) {
                    if (Schema::hasColumn('customer_service_package_balances', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
        if (Schema::hasTable('customer_service_packages')) {
            Schema::table('customer_service_packages', function (Blueprint $table) {
                foreach (['purchase_reference_snapshot', 'refunded_amount_snapshot', 'purchase_amount_snapshot', 'selling_price_snapshot', 'package_name_snapshot'] as $column) {
                    if (Schema::hasColumn('customer_service_packages', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
