<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('store_locations', function (Blueprint $table) {
            // Pickup was available at every active location before this flag existed.
            $table->boolean('is_pickup_available')->default(true)->after('is_active');
            $table->boolean('is_booking_available')->default(false)->after('is_pickup_available');
            $table->boolean('is_pos_available')->default(false)->after('is_booking_available');
            $table->unsignedInteger('sort_order')->default(0)->after('is_pos_available');

            $table->index(['is_active', 'is_pickup_available', 'sort_order'], 'store_locations_pickup_index');
            $table->index(['is_active', 'is_booking_available', 'sort_order'], 'store_locations_booking_index');
            $table->index(['is_active', 'is_pos_available', 'sort_order'], 'store_locations_pos_index');
        });
    }

    public function down(): void
    {
        Schema::table('store_locations', function (Blueprint $table) {
            $table->dropIndex('store_locations_pickup_index');
            $table->dropIndex('store_locations_booking_index');
            $table->dropIndex('store_locations_pos_index');
            $table->dropColumn([
                'is_pickup_available',
                'is_booking_available',
                'is_pos_available',
                'sort_order',
            ]);
        });
    }
};
