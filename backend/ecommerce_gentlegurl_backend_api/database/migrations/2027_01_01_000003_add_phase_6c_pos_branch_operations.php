<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->index(['store_location_id', 'event_type', 'opened_at'], 'cash_shift_branch_event_idx');
        });

        Schema::table('pos_cash_pool_accounts', function (Blueprint $table) {
            $table->dropUnique('pos_cash_pool_accounts_code_unique');
            $table->foreignId('store_location_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->unique(['store_location_id', 'code'], 'cash_pool_branch_code_unique');
        });

        Schema::create('store_location_pos_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('printer_enabled')->default(false);
            $table->string('printer_name')->nullable();
            $table->string('printer_connection_type', 20)->default('network');
            $table->string('printer_ip_address', 253)->nullable();
            $table->unsignedSmallInteger('printer_port')->nullable()->default(9100);
            $table->unsignedSmallInteger('printer_paper_width')->default(80);
            $table->boolean('printer_auto_print_receipt')->default(true);
            $table->unsignedTinyInteger('printer_copies')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (DB::table('pos_cash_pool_accounts')->select('code')->groupBy('code')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new LogicException('Cannot remove Branch cash accounts while duplicate account codes exist; export and consolidate them first.');
        }
        Schema::dropIfExists('store_location_pos_settings');
        Schema::table('pos_cash_pool_accounts', function (Blueprint $table) {
            $table->dropUnique('cash_pool_branch_code_unique');
            $table->dropConstrainedForeignId('store_location_id');
            $table->unique('code');
        });
        Schema::table('pos_cash_shifts', function (Blueprint $table) {
            $table->dropIndex('cash_shift_branch_event_idx');
            $table->dropConstrainedForeignId('store_location_id');
        });
    }
};
