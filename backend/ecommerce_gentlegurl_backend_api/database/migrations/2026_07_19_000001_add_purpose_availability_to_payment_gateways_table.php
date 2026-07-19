<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            // Defaults intentionally preserve existing checkout availability and
            // require an explicit CRM decision before exposing wallet top-ups.
            $table->boolean('allow_checkout')->default(true)->after('is_active');
            $table->boolean('allow_wallet_topup')->default(false)->after('allow_checkout');
        });
    }

    public function down(): void
    {
        Schema::table('payment_gateways', function (Blueprint $table) {
            $table->dropColumn(['allow_checkout', 'allow_wallet_topup']);
        });
    }
};
