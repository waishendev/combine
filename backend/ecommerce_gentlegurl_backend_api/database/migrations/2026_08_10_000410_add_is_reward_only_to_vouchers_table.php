<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('vouchers', 'is_reward_only')) {
                $table->boolean('is_reward_only')->default(false)->after('is_active');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('vouchers', 'is_reward_only')) {
                $table->dropColumn('is_reward_only');
            }
        });
    }
};
