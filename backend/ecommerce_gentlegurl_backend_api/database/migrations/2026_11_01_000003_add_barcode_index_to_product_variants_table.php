<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('product_variants')) {
            return;
        }

        Schema::table('product_variants', function (Blueprint $table) {
            if (! Schema::hasColumn('product_variants', 'barcode')) {
                $table->string('barcode')->nullable()->after('sku');
            }
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->index('barcode', 'product_variants_barcode_index');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_variants')) {
            return;
        }

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex('product_variants_barcode_index');
        });
    }
};
