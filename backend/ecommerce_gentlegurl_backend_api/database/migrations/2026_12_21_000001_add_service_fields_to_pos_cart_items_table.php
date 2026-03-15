<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_cart_items', 'type')) {
                $table->string('type', 20)->default('product')->after('pos_cart_id');
            }
            if (!Schema::hasColumn('pos_cart_items', 'booking_service_id')) {
                $table->foreignId('booking_service_id')->nullable()->after('product_id')->constrained('booking_services')->nullOnDelete();
            }
            if (!Schema::hasColumn('pos_cart_items', 'service_name')) {
                $table->string('service_name')->nullable()->after('booking_service_id');
            }
            if (!Schema::hasColumn('pos_cart_items', 'staff_id')) {
                $table->foreignId('staff_id')->nullable()->after('service_name')->constrained('staffs')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_items', 'staff_id')) {
                $table->dropConstrainedForeignId('staff_id');
            }
            if (Schema::hasColumn('pos_cart_items', 'service_name')) {
                $table->dropColumn('service_name');
            }
            if (Schema::hasColumn('pos_cart_items', 'booking_service_id')) {
                $table->dropConstrainedForeignId('booking_service_id');
            }
            if (Schema::hasColumn('pos_cart_items', 'type')) {
                $table->dropColumn('type');
            }
        });
    }
};
