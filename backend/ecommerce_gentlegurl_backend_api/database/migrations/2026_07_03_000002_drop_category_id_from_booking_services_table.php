<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Categories are stored via booking_service_category_service (many-to-many).
     * Run `php artisan booking:migrate-service-categories` before this migration
     * to merge booking_services.category_id into the pivot table.
     */
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'category_id')) {
                $table->dropForeign(['category_id']);
                $table->dropIndex(['category_id']);
                $table->dropColumn('category_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_services', 'category_id')) {
                $table->unsignedBigInteger('category_id')->nullable()->after('id');
                $table->index('category_id');
                $table->foreign('category_id')->references('id')->on('booking_service_categories')->nullOnDelete();
            }
        });
    }
};
