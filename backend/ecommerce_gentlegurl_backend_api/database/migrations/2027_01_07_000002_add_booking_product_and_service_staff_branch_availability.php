<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_product_store_location', function (Blueprint $table) {
            $table->foreignId('booking_product_id')->constrained('booking_products')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['booking_product_id', 'store_location_id'], 'booking_product_store_unique');
            $table->index(['store_location_id', 'booking_product_id'], 'booking_product_store_lookup');
        });

        Schema::table('booking_service_staff', function (Blueprint $table) {
            $table->dropUnique(['service_id', 'staff_id']);
            $table->foreignId('store_location_id')->nullable()->after('staff_id')
                ->constrained('store_locations')->cascadeOnDelete();
            // NULL deliberately denotes an unresolved legacy global row. It is never
            // treated as belonging to the current/first Branch at runtime.
            $table->unique(['service_id', 'store_location_id', 'staff_id'], 'booking_service_branch_staff_unique');
            $table->index(['store_location_id', 'service_id', 'is_active'], 'booking_service_branch_staff_lookup');
        });
    }

    public function down(): void
    {
        Schema::table('booking_service_staff', function (Blueprint $table) {
            $table->dropIndex('booking_service_branch_staff_lookup');
            $table->dropUnique('booking_service_branch_staff_unique');
            $table->dropConstrainedForeignId('store_location_id');
            $table->unique(['service_id', 'staff_id']);
        });
        Schema::dropIfExists('booking_product_store_location');
    }
};
