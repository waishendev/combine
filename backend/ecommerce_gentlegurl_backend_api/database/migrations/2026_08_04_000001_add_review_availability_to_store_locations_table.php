<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_locations', function (Blueprint $table) {
            $table->boolean('is_review_available')->default(true)->after('is_pickup_available');
            $table->index(['is_active', 'is_review_available', 'sort_order'], 'store_locations_review_index');
        });
    }

    public function down(): void
    {
        Schema::table('store_locations', function (Blueprint $table) {
            $table->dropIndex('store_locations_review_index');
            $table->dropColumn('is_review_available');
        });
    }
};
