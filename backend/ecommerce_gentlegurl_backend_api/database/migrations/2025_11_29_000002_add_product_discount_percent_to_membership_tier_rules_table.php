<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('membership_tier_rules', function (Blueprint $table) {
            $table->decimal('product_discount_percent', 5, 2)->default(0.00)->after('multiplier');
        });
    }

    public function down(): void
    {
        Schema::table('membership_tier_rules', function (Blueprint $table) {
            $table->dropColumn('product_discount_percent');
        });
    }
};
