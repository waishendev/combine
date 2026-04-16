<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            $table->string('price_mode', 10)->default('fixed')->after('price');
            $table->decimal('price_range_min', 12, 2)->nullable()->after('price_mode');
            $table->decimal('price_range_max', 12, 2)->nullable()->after('price_range_min');
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            $table->dropColumn(['price_mode', 'price_range_min', 'price_range_max']);
        });
    }
};
