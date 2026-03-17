<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->string('type', 30)->default('ecommerce')->after('id');
        });

        DB::table('payment_gateways')->whereNull('type')->update(['type' => 'ecommerce']);

        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->dropUnique(['key']);
            $table->unique(['type', 'key']);
            $table->index(['type', 'is_active']);
            $table->index(['type', 'is_default']);
        });

        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->string('type', 30)->default('ecommerce')->after('id');
            $table->index(['type', 'is_active']);
            $table->index(['type', 'is_default']);
        });

        DB::table('bank_accounts')->whereNull('type')->update(['type' => 'ecommerce']);
    }

    public function down(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->dropUnique(['type', 'key']);
            $table->dropIndex(['type', 'is_active']);
            $table->dropIndex(['type', 'is_default']);
            $table->unique('key');
            $table->dropColumn('type');
        });

        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->dropIndex(['type', 'is_active']);
            $table->dropIndex(['type', 'is_default']);
            $table->dropColumn('type');
        });
    }
};
