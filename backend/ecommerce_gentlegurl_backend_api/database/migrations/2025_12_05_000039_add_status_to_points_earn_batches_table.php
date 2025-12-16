<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('points_earn_batches', function (Blueprint $table) {
            $table->string('status', 30)->default('active')->after('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('points_earn_batches', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
