<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_location_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_available')->default(true);
            $table->timestamps();
            $table->unique(['store_location_id', 'product_id']);
        });

        Schema::create('store_location_product_inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            $table->timestamps();
            $table->index(['product_id', 'product_variant_id']);
        });

        // PostgreSQL and SQLite both treat NULL values as distinct in a regular
        // UNIQUE constraint. Partial indexes enforce the two inventory identities
        // without a generated column or a fake ProductVariant foreign key.
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX slpi_branch_product_no_variant_unique
            ON store_location_product_inventories (store_location_id, product_id)
            WHERE product_variant_id IS NULL
        SQL);
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX slpi_branch_product_variant_unique
            ON store_location_product_inventories (store_location_id, product_id, product_variant_id)
            WHERE product_variant_id IS NOT NULL
        SQL);

        Schema::table('pos_carts', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('staff_user_id')
                ->constrained()->nullOnDelete();
            $table->index(['store_location_id', 'staff_user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_location_id');
        });
        Schema::dropIfExists('store_location_product_inventories');
        Schema::dropIfExists('store_location_product');
    }
};
