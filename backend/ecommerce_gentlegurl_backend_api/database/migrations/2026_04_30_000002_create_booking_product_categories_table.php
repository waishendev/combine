<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_product_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('booking_products', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('image_path')->constrained('booking_product_categories')->nullOnDelete();
            $table->dropColumn('category');
        });
    }

    public function down(): void
    {
        Schema::table('booking_products', function (Blueprint $table) {
            $table->string('category')->nullable();
            $table->dropConstrainedForeignId('category_id');
        });
        Schema::dropIfExists('booking_product_categories');
    }
};
