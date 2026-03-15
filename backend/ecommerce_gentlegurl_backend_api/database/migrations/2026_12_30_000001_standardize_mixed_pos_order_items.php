<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('line_type', 40)->default('product')->after('order_id');
            $table->string('display_name_snapshot', 255)->nullable()->after('product_name_snapshot');

            $table->foreignId('booking_id')->nullable()->after('parent_package_item_id')->constrained('bookings')->nullOnDelete();
            $table->foreignId('booking_service_id')->nullable()->after('booking_id')->constrained('booking_services')->nullOnDelete();
            $table->foreignId('service_package_id')->nullable()->after('booking_service_id')->constrained('service_packages')->nullOnDelete();
            $table->foreignId('customer_service_package_id')->nullable()->after('service_package_id')->constrained('customer_service_packages')->nullOnDelete();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_service_package_id');
            $table->dropConstrainedForeignId('service_package_id');
            $table->dropConstrainedForeignId('booking_service_id');
            $table->dropConstrainedForeignId('booking_id');
            $table->dropColumn(['line_type', 'display_name_snapshot']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable(false)->change();
        });
    }
};

