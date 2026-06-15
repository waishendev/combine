<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'cn_name')) {
                $table->string('cn_name')->nullable()->after('name');
            }
        });

        // product_variants may not exist yet on fresh installs (table is created later).
        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                if (! Schema::hasColumn('product_variants', 'cn_name')) {
                    $table->string('cn_name')->nullable()->after('title');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'cn_name')) {
                $table->dropColumn('cn_name');
            }
        });

        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                if (Schema::hasColumn('product_variants', 'cn_name')) {
                    $table->dropColumn('cn_name');
                }
            });
        }
    }
};
