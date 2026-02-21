<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_carts', 'voucher_id')) {
                $table->foreignId('voucher_id')->nullable()->after('staff_user_id')->constrained('vouchers')->nullOnDelete();
            }

            if (!Schema::hasColumn('pos_carts', 'customer_voucher_id')) {
                $table->foreignId('customer_voucher_id')->nullable()->after('voucher_id')->constrained('customer_vouchers')->nullOnDelete();
            }

            if (!Schema::hasColumn('pos_carts', 'voucher_code')) {
                $table->string('voucher_code')->nullable()->after('customer_voucher_id');
            }

            if (!Schema::hasColumn('pos_carts', 'voucher_discount_amount')) {
                $table->decimal('voucher_discount_amount', 12, 2)->default(0)->after('voucher_code');
            }

            if (!Schema::hasColumn('pos_carts', 'voucher_snapshot')) {
                $table->json('voucher_snapshot')->nullable()->after('voucher_discount_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            if (Schema::hasColumn('pos_carts', 'voucher_snapshot')) {
                $table->dropColumn('voucher_snapshot');
            }

            if (Schema::hasColumn('pos_carts', 'voucher_discount_amount')) {
                $table->dropColumn('voucher_discount_amount');
            }

            if (Schema::hasColumn('pos_carts', 'voucher_code')) {
                $table->dropColumn('voucher_code');
            }

            if (Schema::hasColumn('pos_carts', 'customer_voucher_id')) {
                $table->dropConstrainedForeignId('customer_voucher_id');
            }

            if (Schema::hasColumn('pos_carts', 'voucher_id')) {
                $table->dropConstrainedForeignId('voucher_id');
            }
        });
    }
};
