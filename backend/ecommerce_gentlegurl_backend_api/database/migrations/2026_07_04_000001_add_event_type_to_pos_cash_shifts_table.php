<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_cash_shifts', 'event_type')) {
                $table->string('event_type', 10)->default('OPEN')->after('id');
            }

            if (! Schema::hasColumn('pos_cash_shifts', 'linked_open_shift_id')) {
                $table->foreignId('linked_open_shift_id')
                    ->nullable()
                    ->after('event_type')
                    ->constrained('pos_cash_shifts')
                    ->nullOnDelete();
            }
        });

        if (Schema::hasColumn('pos_cash_shifts', 'event_type')) {
            DB::table('pos_cash_shifts')
                ->where('status', 'CLOSED')
                ->update(['event_type' => 'CLOSE']);

            DB::table('pos_cash_shifts')
                ->where('status', 'OPEN')
                ->update(['event_type' => 'OPEN']);
        }
    }

    public function down(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            if (Schema::hasColumn('pos_cash_shifts', 'linked_open_shift_id')) {
                $table->dropConstrainedForeignId('linked_open_shift_id');
            }

            if (Schema::hasColumn('pos_cash_shifts', 'event_type')) {
                $table->dropColumn('event_type');
            }
        });
    }
};
