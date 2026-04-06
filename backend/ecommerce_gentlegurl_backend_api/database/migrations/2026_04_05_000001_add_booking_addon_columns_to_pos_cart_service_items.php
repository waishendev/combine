<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            $table->unsignedInteger('addon_duration_min')->default(0)->after('end_at');
            $table->decimal('addon_price', 12, 2)->default(0)->after('addon_duration_min');
            $table->json('selected_option_ids')->nullable()->after('addon_price');
            $table->json('addon_items_json')->nullable()->after('selected_option_ids');
        });
    }

    public function down(): void
    {
        Schema::table('pos_cart_service_items', function (Blueprint $table) {
            $table->dropColumn(['addon_duration_min', 'addon_price', 'selected_option_ids', 'addon_items_json']);
        });
    }
};
