<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_carts', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('guest_token')
                ->constrained('store_locations')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('booking_carts', fn (Blueprint $table) => $table->dropConstrainedForeignId('store_location_id'));
    }
};
