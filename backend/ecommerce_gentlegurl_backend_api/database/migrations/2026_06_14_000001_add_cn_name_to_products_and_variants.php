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

        Schema::table('product_variants', function (Blueprint $table) {
            if (! Schema::hasColumn('product_variants', 'cn_name')) {
                $table->string('cn_name')->nullable()->after('title');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'cn_name')) {
                $table->dropColumn('cn_name');
            }
        });

        Schema::table('product_variants', function (Blueprint $table) {
            if (Schema::hasColumn('product_variants', 'cn_name')) {
                $table->dropColumn('cn_name');
            }
        });
    }
};
