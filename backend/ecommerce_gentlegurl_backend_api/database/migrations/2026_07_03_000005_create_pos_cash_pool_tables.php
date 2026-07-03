<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pos_cash_pool_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->decimal('total_initial_cash', 14, 2)->default(0);
            $table->decimal('total_withdraw', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('pos_cash_pool_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_cash_pool_account_id')->constrained('pos_cash_pool_accounts')->cascadeOnDelete();
            $table->foreignId('pos_cash_shift_id')->nullable()->constrained('pos_cash_shifts')->nullOnDelete();
            $table->string('action', 40);
            $table->decimal('initial_cash_delta', 14, 2)->default(0);
            $table->decimal('withdraw_delta', 14, 2)->default(0);
            $table->decimal('initial_cash_after', 14, 2);
            $table->decimal('withdraw_after', 14, 2);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['pos_cash_pool_account_id', 'created_at']);
            $table->index(['pos_cash_shift_id', 'action']);
        });

        DB::table('pos_cash_pool_accounts')->insert([
            'code' => 'default',
            'total_initial_cash' => 0,
            'total_withdraw' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (Schema::hasTable('pos_cash_shifts') && Schema::hasColumn('pos_cash_shifts', 'total_initial_cash')) {
            $latest = DB::table('pos_cash_shifts')
                ->orderByDesc('id')
                ->first(['total_initial_cash', 'total_withdraw']);

            if ($latest) {
                DB::table('pos_cash_pool_accounts')
                    ->where('code', 'default')
                    ->update([
                        'total_initial_cash' => (float) ($latest->total_initial_cash ?? 0),
                        'total_withdraw' => (float) ($latest->total_withdraw ?? 0),
                        'updated_at' => now(),
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_cash_pool_ledger');
        Schema::dropIfExists('pos_cash_pool_accounts');
    }
};
