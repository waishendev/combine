<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('staff_store_location', function (Blueprint $table) {
            $table->foreignId('staff_id')->constrained('staffs')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['staff_id', 'store_location_id']);
            $table->index(['store_location_id', 'staff_id']);
        });

        Schema::create('booking_service_store_location', function (Blueprint $table) {
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['booking_service_id', 'store_location_id'], 'booking_service_store_unique');
            $table->index(['store_location_id', 'booking_service_id'], 'booking_service_store_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_service_store_location');
        Schema::dropIfExists('staff_store_location');
    }
};
