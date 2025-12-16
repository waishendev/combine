<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'track_stock')) {
                $table->boolean('track_stock')->default(true)->after('low_stock_threshold');
            }

            if (! Schema::hasColumn('products', 'low_stock_threshold')) {
                $table->integer('low_stock_threshold')->default(0)->after('stock');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'track_stock')) {
                $table->dropColumn('track_stock');
            }

            // We intentionally do not drop low_stock_threshold to avoid removing existing data.
        });
    }
};
