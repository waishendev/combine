<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('order_vouchers', 'scope_snapshot')) {
                $table->json('scope_snapshot')->nullable()->after('discount_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('order_vouchers', 'scope_snapshot')) {
                $table->dropColumn('scope_snapshot');
            }
        });
    }
};
