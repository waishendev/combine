<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('vouchers', 'scope_type')) {
                $table->string('scope_type', 20)->default('all')->after('min_order_amount');
            }
        });

        Schema::create('voucher_products', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['voucher_id', 'product_id']);
        });

        Schema::create('voucher_categories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['voucher_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_categories');
        Schema::dropIfExists('voucher_products');

        Schema::table('vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('vouchers', 'scope_type')) {
                $table->dropColumn('scope_type');
            }
        });
    }
};
