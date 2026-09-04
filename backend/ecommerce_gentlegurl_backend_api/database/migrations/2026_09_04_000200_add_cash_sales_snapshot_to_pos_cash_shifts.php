<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * NEW ENHANCEMENT — profit-loss-cash-shifts-query-v1
 * Persist cash sales on CLOSE + sort helper index for report list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cash_shifts', 'cash_sales_snapshot')) {
                $table->decimal('cash_sales_snapshot', 12, 2)->nullable()->after('total_withdraw');
            }
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS pos_cash_shifts_event_at_coalesce_idx ON pos_cash_shifts (COALESCE(closed_at, opened_at) DESC)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS pos_cash_shifts_event_at_coalesce_idx');
        }

        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cash_shifts', 'cash_sales_snapshot')) {
                $table->dropColumn('cash_sales_snapshot');
            }
        });
    }
};
