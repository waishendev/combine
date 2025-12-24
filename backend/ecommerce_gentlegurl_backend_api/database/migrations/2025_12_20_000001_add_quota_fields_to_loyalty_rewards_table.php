<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loyalty_rewards', function (Blueprint $table) {
            $table->integer('quota_total')->nullable()->after('voucher_id');
            $table->integer('quota_used')->default(0)->after('quota_total');
        });
    }

    public function down(): void
    {
        Schema::table('loyalty_rewards', function (Blueprint $table) {
            $table->dropColumn(['quota_total', 'quota_used']);
        });
    }
};
