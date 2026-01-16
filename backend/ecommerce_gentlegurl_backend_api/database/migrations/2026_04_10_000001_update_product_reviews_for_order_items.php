<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_reviews', function (Blueprint $table) {
            $table->unsignedBigInteger('variant_id')
                ->nullable()
                ->after('order_item_id');

            $table->dropUnique('product_reviews_customer_id_product_id_unique');
            $table->unique('order_item_id');
        });
    }

    public function down(): void
    {
        Schema::table('product_reviews', function (Blueprint $table) {
            $table->dropUnique(['order_item_id']);
            $table->unique(['customer_id', 'product_id']);
            $table->dropColumn('variant_id');
        });
    }
};
