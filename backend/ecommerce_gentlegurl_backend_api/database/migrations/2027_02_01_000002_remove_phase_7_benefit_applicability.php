<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // The first-version business rule is global benefit eligibility. These
        // pivots contained configuration only and never transaction history.
        Schema::dropIfExists('loyalty_reward_store_location');
        Schema::dropIfExists('voucher_store_location');
    }

    public function down(): void
    {
        if (! Schema::hasTable('voucher_store_location')) {
            Schema::create('voucher_store_location', function (Blueprint $table) {
                $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
                $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
                $table->timestamps();
                $table->primary(['voucher_id', 'store_location_id']);
            });
        }

        if (! Schema::hasTable('loyalty_reward_store_location')) {
            Schema::create('loyalty_reward_store_location', function (Blueprint $table) {
                $table->foreignId('loyalty_reward_id')->constrained('loyalty_rewards')->cascadeOnDelete();
                $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
                $table->timestamps();
                $table->primary(['loyalty_reward_id', 'store_location_id'], 'loyalty_reward_store_location_pk');
            });
        }
    }
};
