<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loyalty_settings', function (Blueprint $table) {
            $table->decimal('ecommerce_earning_rate', 8, 2)->nullable()->after('base_multiplier');
            $table->boolean('ecommerce_redemption_enabled')->default(false);
            $table->unsignedInteger('ecommerce_point_value_sen')->default(1);
            $table->decimal('ecommerce_max_redemption_percent', 5, 2)->default(20);
            $table->decimal('booking_earning_rate', 8, 2)->nullable();
            $table->boolean('booking_redemption_enabled')->default(false);
            $table->unsignedInteger('booking_point_value_sen')->default(1);
            $table->decimal('booking_max_redemption_percent', 5, 2)->default(20);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('loyalty_points_used')->default(0);
            $table->decimal('loyalty_discount', 12, 2)->default(0);
            $table->unsignedInteger('loyalty_point_value_sen')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn([
            'loyalty_points_used', 'loyalty_discount', 'loyalty_point_value_sen',
        ]));
        Schema::table('loyalty_settings', fn (Blueprint $table) => $table->dropColumn([
            'ecommerce_earning_rate', 'ecommerce_redemption_enabled', 'ecommerce_point_value_sen',
            'ecommerce_max_redemption_percent', 'booking_earning_rate', 'booking_redemption_enabled',
            'booking_point_value_sen', 'booking_max_redemption_percent',
        ]));
    }
};
