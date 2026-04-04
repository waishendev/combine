<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('booking_service_primary_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_service_id')->constrained('booking_services')->cascadeOnDelete();
            $table->time('start_time');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['booking_service_id', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_service_primary_slots');
    }
};
