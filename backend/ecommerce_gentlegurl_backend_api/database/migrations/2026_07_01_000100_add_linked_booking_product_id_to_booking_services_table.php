<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_services', 'linked_booking_product_id')) {
                $table->foreignId('linked_booking_product_id')
                    ->nullable()
                    ->after('image_path')
                    ->constrained('booking_products')
                    ->nullOnDelete();

                $table->unique('linked_booking_product_id', 'booking_services_linked_booking_product_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'linked_booking_product_id')) {
                $table->dropUnique('booking_services_linked_booking_product_unique');
                $table->dropConstrainedForeignId('linked_booking_product_id');
            }
        });
    }
};
