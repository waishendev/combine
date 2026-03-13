<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('type', 30)->default('ecommerce')->after('key');
        });

        DB::table('announcements')
            ->whereNull('type')
            ->orWhere('type', '')
            ->update(['type' => 'ecommerce']);

        Schema::table('marquees', function (Blueprint $table) {
            $table->string('type', 30)->default('ecommerce')->after('id');
        });

        DB::table('marquees')
            ->whereNull('type')
            ->orWhere('type', '')
            ->update(['type' => 'ecommerce']);
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn('type');
        });

        Schema::table('marquees', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
