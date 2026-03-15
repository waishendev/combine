<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_service_package_usages', function (Blueprint $table) {
            if (! Schema::hasColumn('customer_service_package_usages', 'booking_id')) {
                $table->foreignId('booking_id')->nullable()->after('customer_id')->constrained('bookings')->nullOnDelete();
            }
            if (! Schema::hasColumn('customer_service_package_usages', 'status')) {
                $table->enum('status', ['reserved', 'consumed', 'released'])->default('consumed')->after('used_ref_id');
                $table->index(['status', 'booking_id']);
            }
            if (! Schema::hasColumn('customer_service_package_usages', 'reserved_at')) {
                $table->dateTime('reserved_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('customer_service_package_usages', 'consumed_at')) {
                $table->dateTime('consumed_at')->nullable()->after('reserved_at');
            }
            if (! Schema::hasColumn('customer_service_package_usages', 'released_at')) {
                $table->dateTime('released_at')->nullable()->after('consumed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_service_package_usages', function (Blueprint $table) {
            if (Schema::hasColumn('customer_service_package_usages', 'released_at')) {
                $table->dropColumn('released_at');
            }
            if (Schema::hasColumn('customer_service_package_usages', 'consumed_at')) {
                $table->dropColumn('consumed_at');
            }
            if (Schema::hasColumn('customer_service_package_usages', 'reserved_at')) {
                $table->dropColumn('reserved_at');
            }
            if (Schema::hasColumn('customer_service_package_usages', 'status')) {
                $table->dropIndex(['status', 'booking_id']);
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('customer_service_package_usages', 'booking_id')) {
                $table->dropConstrainedForeignId('booking_id');
            }
        });
    }
};
