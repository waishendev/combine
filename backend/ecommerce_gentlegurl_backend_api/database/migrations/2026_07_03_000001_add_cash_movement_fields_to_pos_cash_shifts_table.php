<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cash_shifts', 'refill_cash_packet_amount')) {
                $table->decimal('refill_cash_packet_amount', 12, 2)->default(0)->after('opening_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'atm_amount')) {
                $table->decimal('atm_amount', 12, 2)->default(0)->after('refill_cash_packet_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'withdraw_amount')) {
                $table->decimal('withdraw_amount', 12, 2)->default(0)->after('closing_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'refill_cash_amount')) {
                $table->decimal('refill_cash_amount', 12, 2)->default(0)->after('withdraw_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'refill_cash_packet_note')) {
                $table->text('refill_cash_packet_note')->nullable()->after('refill_cash_packet_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'atm_note')) {
                $table->text('atm_note')->nullable()->after('atm_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'withdraw_note')) {
                $table->text('withdraw_note')->nullable()->after('withdraw_amount');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'refill_cash_note')) {
                $table->text('refill_cash_note')->nullable()->after('refill_cash_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            foreach ([
                'refill_cash_note',
                'withdraw_note',
                'atm_note',
                'refill_cash_packet_note',
                'refill_cash_amount',
                'withdraw_amount',
                'atm_amount',
                'refill_cash_packet_amount',
            ] as $column) {
                if (Schema::hasColumn('pos_cash_shifts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
