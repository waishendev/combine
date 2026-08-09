<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('points_transactions', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('customer_id')->constrained('store_locations')->nullOnDelete();
            $table->index(['store_location_id', 'created_at']);
        });
        Schema::table('customer_service_packages', function (Blueprint $table) {
            $table->foreignId('purchase_store_location_id')->nullable()->after('service_package_id')->constrained('store_locations')->nullOnDelete();
        });
        Schema::table('customer_service_package_usages', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('booking_id')->constrained('store_locations')->nullOnDelete();
            $table->index(['store_location_id', 'created_at']);
        });
        Schema::table('voucher_usages', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->constrained('store_locations')->nullOnDelete();
        });
        Schema::table('loyalty_redemptions', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('reward_id')->constrained('store_locations')->nullOnDelete();
            $table->string('idempotency_key', 100)->nullable();
            $table->unique(['customer_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::table('loyalty_redemptions', function (Blueprint $table) {
            $table->dropUnique(['customer_id', 'idempotency_key']);
            $table->dropConstrainedForeignId('store_location_id');
            $table->dropColumn('idempotency_key');
        });
        Schema::table('voucher_usages', fn (Blueprint $table) => $table->dropConstrainedForeignId('store_location_id'));
        Schema::table('customer_service_package_usages', function (Blueprint $table) {
            $table->dropIndex(['store_location_id', 'created_at']);
            $table->dropConstrainedForeignId('store_location_id');
        });
        Schema::table('customer_service_packages', fn (Blueprint $table) => $table->dropConstrainedForeignId('purchase_store_location_id'));
        Schema::table('points_transactions', function (Blueprint $table) {
            $table->dropIndex(['store_location_id', 'created_at']);
            $table->dropConstrainedForeignId('store_location_id');
        });
    }
};
