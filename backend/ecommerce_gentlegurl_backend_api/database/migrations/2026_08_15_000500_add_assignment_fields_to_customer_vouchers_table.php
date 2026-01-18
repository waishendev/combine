<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('customer_vouchers', 'quantity_total')) {
                $table->unsignedInteger('quantity_total')->default(1)->after('voucher_id');
            }
            if (!Schema::hasColumn('customer_vouchers', 'quantity_used')) {
                $table->unsignedInteger('quantity_used')->default(0)->after('quantity_total');
            }
            if (!Schema::hasColumn('customer_vouchers', 'assigned_by_admin_id')) {
                $table->foreignId('assigned_by_admin_id')
                    ->nullable()
                    ->after('source_redemption_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('customer_vouchers', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('assigned_by_admin_id');
            }
            if (!Schema::hasColumn('customer_vouchers', 'start_at')) {
                $table->timestamp('start_at')->nullable()->after('assigned_at');
            }
            if (!Schema::hasColumn('customer_vouchers', 'end_at')) {
                $table->timestamp('end_at')->nullable()->after('start_at');
            }
            if (!Schema::hasColumn('customer_vouchers', 'note')) {
                $table->text('note')->nullable()->after('end_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('customer_vouchers', 'note')) {
                $table->dropColumn('note');
            }
            if (Schema::hasColumn('customer_vouchers', 'end_at')) {
                $table->dropColumn('end_at');
            }
            if (Schema::hasColumn('customer_vouchers', 'start_at')) {
                $table->dropColumn('start_at');
            }
            if (Schema::hasColumn('customer_vouchers', 'assigned_at')) {
                $table->dropColumn('assigned_at');
            }
            if (Schema::hasColumn('customer_vouchers', 'assigned_by_admin_id')) {
                $table->dropConstrainedForeignId('assigned_by_admin_id');
            }
            if (Schema::hasColumn('customer_vouchers', 'quantity_used')) {
                $table->dropColumn('quantity_used');
            }
            if (Schema::hasColumn('customer_vouchers', 'quantity_total')) {
                $table->dropColumn('quantity_total');
            }
        });
    }
};
