<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'type')) {
                $table->string('type', 20)->default('product')->after('order_id');
            }
            if (!Schema::hasColumn('order_items', 'booking_service_id')) {
                $table->foreignId('booking_service_id')->nullable()->after('product_id')->constrained('booking_services')->nullOnDelete();
            }
            if (!Schema::hasColumn('order_items', 'service_name_snapshot')) {
                $table->string('service_name_snapshot')->nullable()->after('product_name_snapshot');
            }
        });

        DB::statement('ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL');

        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'service_name_snapshot')) {
                $table->dropColumn('service_name_snapshot');
            }
            if (Schema::hasColumn('order_items', 'booking_service_id')) {
                $table->dropConstrainedForeignId('booking_service_id');
            }
            if (Schema::hasColumn('order_items', 'type')) {
                $table->dropColumn('type');
            }
        });
    }
};
