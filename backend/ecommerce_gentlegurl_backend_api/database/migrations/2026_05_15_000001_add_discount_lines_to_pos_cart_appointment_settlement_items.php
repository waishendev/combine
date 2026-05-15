<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pos_cart_appointment_settlement_items')) {
            return;
        }

        Schema::table('pos_cart_appointment_settlement_items', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cart_appointment_settlement_items', 'discount_lines')) {
                $table->json('discount_lines')->nullable()->after('discount_remark');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('pos_cart_appointment_settlement_items')) {
            return;
        }

        Schema::table('pos_cart_appointment_settlement_items', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cart_appointment_settlement_items', 'discount_lines')) {
                $table->dropColumn('discount_lines');
            }
        });
    }
};
