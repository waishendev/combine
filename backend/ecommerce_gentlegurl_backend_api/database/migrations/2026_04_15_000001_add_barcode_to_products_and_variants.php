<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'barcode')) {
                $table->string('barcode', 100)->nullable()->unique()->after('sku');
            }
        });

        // NOTE: product_variants table may not exist yet in older DBs.
        // We add the variants barcode in a later migration after the table is created.
        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                if (! Schema::hasColumn('product_variants', 'barcode')) {
                    $table->string('barcode', 100)->nullable()->unique()->after('sku');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                if (Schema::hasColumn('product_variants', 'barcode')) {
                    $table->dropUnique(['barcode']);
                    $table->dropColumn('barcode');
                }
            });
        }

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'barcode')) {
                $table->dropUnique(['barcode']);
                $table->dropColumn('barcode');
            }
        });
    }
};

