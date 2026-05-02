<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_product_category_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_product_id')->constrained('booking_products')->cascadeOnDelete();
            $table->foreignId('booking_product_category_id')->constrained('booking_product_categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['booking_product_id', 'booking_product_category_id'], 'booking_product_category_product_unique');
            $table->index('booking_product_category_id');
        });

        if (Schema::hasColumn('booking_products', 'category_id')) {
            Schema::table('booking_products', function (Blueprint $table) {
                $table->dropConstrainedForeignId('category_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('booking_products', 'category_id')) {
            Schema::table('booking_products', function (Blueprint $table) {
                $table->foreignId('category_id')->nullable()->after('image_path')->constrained('booking_product_categories')->nullOnDelete();
            });
        }

        Schema::dropIfExists('booking_product_category_product');
    }
};
