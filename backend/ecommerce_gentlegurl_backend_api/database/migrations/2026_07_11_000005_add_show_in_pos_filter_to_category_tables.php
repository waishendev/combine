<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'show_in_pos_filter')) {
                $table->boolean('show_in_pos_filter')->default(true)->after('is_active');
            }
        });

        Schema::table('booking_service_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_service_categories', 'show_in_pos_filter')) {
                $table->boolean('show_in_pos_filter')->default(true)->after('is_active');
            }
        });

        Schema::table('booking_product_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_product_categories', 'show_in_pos_filter')) {
                $table->boolean('show_in_pos_filter')->default(true)->after('is_active');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'show_in_pos_filter')) {
                $table->dropColumn('show_in_pos_filter');
            }
        });

        Schema::table('booking_service_categories', function (Blueprint $table) {
            if (Schema::hasColumn('booking_service_categories', 'show_in_pos_filter')) {
                $table->dropColumn('show_in_pos_filter');
            }
        });

        Schema::table('booking_product_categories', function (Blueprint $table) {
            if (Schema::hasColumn('booking_product_categories', 'show_in_pos_filter')) {
                $table->dropColumn('show_in_pos_filter');
            }
        });
    }
};
