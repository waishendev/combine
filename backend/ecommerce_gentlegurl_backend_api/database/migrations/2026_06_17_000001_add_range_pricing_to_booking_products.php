<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_products', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_products', 'price_mode')) {
                $table->string('price_mode', 10)->default('fixed')->after('price');
            }
            if (! Schema::hasColumn('booking_products', 'price_range_min')) {
                $table->decimal('price_range_min', 12, 2)->nullable()->after('price_mode');
            }
            if (! Schema::hasColumn('booking_products', 'price_range_max')) {
                $table->decimal('price_range_max', 12, 2)->nullable()->after('price_range_min');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_products', function (Blueprint $table) {
            if (Schema::hasColumn('booking_products', 'price_range_max')) {
                $table->dropColumn('price_range_max');
            }
            if (Schema::hasColumn('booking_products', 'price_range_min')) {
                $table->dropColumn('price_range_min');
            }
            if (Schema::hasColumn('booking_products', 'price_mode')) {
                $table->dropColumn('price_mode');
            }
        });
    }
};
