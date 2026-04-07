<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_cart_items', function (Blueprint $table) {
            $table->unsignedInteger('addon_duration_min')->default(0)->after('end_at');
            $table->decimal('addon_price', 12, 2)->default(0)->after('addon_duration_min');
            $table->json('question_answers_json')->nullable()->after('addon_price');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedInteger('addon_duration_min')->default(0)->after('buffer_min');
            $table->decimal('addon_price', 12, 2)->default(0)->after('deposit_amount');
            $table->json('addon_items_json')->nullable()->after('addon_price');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['addon_duration_min', 'addon_price', 'addon_items_json']);
        });

        Schema::table('booking_cart_items', function (Blueprint $table) {
            $table->dropColumn(['addon_duration_min', 'addon_price', 'question_answers_json']);
        });
    }
};
