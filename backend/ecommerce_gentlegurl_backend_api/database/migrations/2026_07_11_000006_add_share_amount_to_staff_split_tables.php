<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_item_staff_splits')) {
            Schema::table('order_item_staff_splits', function (Blueprint $table) {
                if (! Schema::hasColumn('order_item_staff_splits', 'share_amount')) {
                    $table->decimal('share_amount', 12, 2)->nullable()->after('share_percent');
                }
            });
        }

        if (Schema::hasTable('booking_service_staff_splits')) {
            Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                if (! Schema::hasColumn('booking_service_staff_splits', 'share_amount')) {
                    $table->decimal('share_amount', 12, 2)->nullable()->after('split_percent');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_item_staff_splits')) {
            Schema::table('order_item_staff_splits', function (Blueprint $table) {
                if (Schema::hasColumn('order_item_staff_splits', 'share_amount')) {
                    $table->dropColumn('share_amount');
                }
            });
        }

        if (Schema::hasTable('booking_service_staff_splits')) {
            Schema::table('booking_service_staff_splits', function (Blueprint $table) {
                if (Schema::hasColumn('booking_service_staff_splits', 'share_amount')) {
                    $table->dropColumn('share_amount');
                }
            });
        }
    }
};
