<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('promotions') && Schema::hasColumn('promotions', 'promotion_type')) {
            Schema::table('promotions', function (Blueprint $table) {
                $table->dropColumn('promotion_type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('promotions') && ! Schema::hasColumn('promotions', 'promotion_type')) {
            Schema::table('promotions', function (Blueprint $table) {
                $table->string('promotion_type')->nullable()->after('description');
            });
        }
    }
};
