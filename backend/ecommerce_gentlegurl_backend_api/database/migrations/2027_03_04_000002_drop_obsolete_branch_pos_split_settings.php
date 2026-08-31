<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::dropIfExists('store_location_pos_payment_settings');
    }

    public function down(): void
    {
        Schema::create('store_location_pos_payment_settings', function (Blueprint $table) {
            $table->foreignId('store_location_id')->primary()->constrained('store_locations')->cascadeOnDelete();
            $table->boolean('allow_split_payment')->default(true);
            $table->boolean('auto_calculate_split')->default(true);
            $table->timestamps();
        });
    }
};
