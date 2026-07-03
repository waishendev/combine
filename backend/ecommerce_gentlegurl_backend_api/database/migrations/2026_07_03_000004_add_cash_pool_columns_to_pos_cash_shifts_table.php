<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cash_shifts', 'opening_refill_packet')) {
                $table->decimal('opening_refill_packet', 12, 2)->nullable()->after('opening_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'opening_atm')) {
                $table->decimal('opening_atm', 12, 2)->nullable()->after('opening_refill_packet');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'closing_withdraw')) {
                $table->decimal('closing_withdraw', 12, 2)->nullable()->after('closing_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'closing_refill_cash')) {
                $table->decimal('closing_refill_cash', 12, 2)->nullable()->after('closing_withdraw');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'total_initial_cash')) {
                $table->decimal('total_initial_cash', 12, 2)->nullable()->after('remark');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'total_withdraw')) {
                $table->decimal('total_withdraw', 12, 2)->nullable()->after('total_initial_cash');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            foreach ([
                'total_withdraw',
                'total_initial_cash',
                'closing_refill_cash',
                'closing_withdraw',
                'opening_atm',
                'opening_refill_packet',
            ] as $column) {
                if (Schema::hasColumn('pos_cash_shifts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
