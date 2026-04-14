<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Safety: ensure products.barcode exists even if earlier migration was skipped.
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'barcode')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('barcode', 100)->nullable()->unique()->after('sku');
            });
        }

        if (Schema::hasTable('product_variants') && ! Schema::hasColumn('product_variants', 'barcode')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->string('barcode', 100)->nullable()->unique()->after('sku');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_variants') && Schema::hasColumn('product_variants', 'barcode')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->dropUnique(['barcode']);
                $table->dropColumn('barcode');
            });
        }

        if (Schema::hasTable('products') && Schema::hasColumn('products', 'barcode')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropUnique(['barcode']);
                $table->dropColumn('barcode');
            });
        }
    }
};

