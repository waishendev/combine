<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'wallet_balance')) {
                $table->decimal('wallet_balance', 12, 2)->default(0)->after('allow_booking_without_deposit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'wallet_balance')) {
                $table->dropColumn('wallet_balance');
            }
        });
    }
};
