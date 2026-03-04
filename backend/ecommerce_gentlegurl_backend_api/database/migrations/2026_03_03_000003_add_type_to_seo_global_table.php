<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('seo_global', function (Blueprint $table) {
            $table->string('type')->default('ecommerce')->after('id');
        });

        DB::table('seo_global')->update(['type' => 'ecommerce']);

        Schema::table('seo_global', function (Blueprint $table) {
            $table->unique('type');
        });
    }

    public function down(): void
    {
        Schema::table('seo_global', function (Blueprint $table) {
            $table->dropUnique('seo_global_type_unique');
            $table->dropColumn('type');
        });
    }
};
