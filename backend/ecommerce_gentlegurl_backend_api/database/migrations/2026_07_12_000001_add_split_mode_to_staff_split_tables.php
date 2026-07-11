<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_item_staff_splits') && ! Schema::hasColumn('order_item_staff_splits', 'split_mode')) {
            Schema::table('order_item_staff_splits', function (Blueprint $table) {
                $table->string('split_mode', 16)->nullable()->after('share_amount');
            });
        }

        if (Schema::hasTable('booking_service_staff_splits') && ! Schema::hasColumn('booking_service_staff_splits', 'split_mode')) {
            Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                $table->string('split_mode', 16)->nullable()->after('share_amount');
            });
        }

        if (Schema::hasTable('service_package_staff_splits') && ! Schema::hasColumn('service_package_staff_splits', 'split_mode')) {
            Schema::table('service_package_staff_splits', function (Blueprint $table) {
                $table->string('split_mode', 16)->nullable()->after('share_percent');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_item_staff_splits') && Schema::hasColumn('order_item_staff_splits', 'split_mode')) {
            Schema::table('order_item_staff_splits', function (Blueprint $table) {
                $table->dropColumn('split_mode');
            });
        }

        if (Schema::hasTable('booking_service_staff_splits') && Schema::hasColumn('booking_service_staff_splits', 'split_mode')) {
            Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                $table->dropColumn('split_mode');
            });
        }

        if (Schema::hasTable('service_package_staff_splits') && Schema::hasColumn('service_package_staff_splits', 'split_mode')) {
            Schema::table('service_package_staff_splits', function (Blueprint $table) {
                $table->dropColumn('split_mode');
            });
        }
    }
};
