<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Note: pos_cart_service_items is created in 2026_12_20_000004 (after this file).
        // If the table does not exist yet, this migration skips it and is still marked Ran.
        // 2026_12_31_000301_ensure_pos_price_override_columns_on_late_tables backfills the column.
        foreach (['pos_cart_service_items', 'pos_cart_appointment_settlement_items'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'price_override_lines')) {
                    $table->json('price_override_lines')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['pos_cart_service_items', 'pos_cart_appointment_settlement_items'] as $tableName) {
            if (! Schema::hasTable($tableName) || ! Schema::hasColumn($tableName, 'price_override_lines')) {
                continue;
            }
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('price_override_lines');
            });
        }
    }
};
