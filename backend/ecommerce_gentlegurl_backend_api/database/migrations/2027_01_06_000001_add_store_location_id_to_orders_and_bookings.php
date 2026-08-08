<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('pickup_store_id')->constrained('store_locations')->restrictOnDelete();
        });
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('source')->constrained('store_locations')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropConstrainedForeignId('store_location_id'));
        Schema::table('bookings', fn (Blueprint $table) => $table->dropConstrainedForeignId('store_location_id'));
    }
};
