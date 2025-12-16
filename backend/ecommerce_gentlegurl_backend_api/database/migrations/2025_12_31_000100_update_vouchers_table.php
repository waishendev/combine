<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('vouchers', 'code')) {
                $table->string('code')->unique()->after('id');
            }

            if (!Schema::hasColumn('vouchers', 'type')) {
                $table->enum('type', ['fixed', 'percent'])->default('fixed')->after('code');
            }

            if (!Schema::hasColumn('vouchers', 'value')) {
                $table->decimal('value', 10, 2)->after('type');
            }

            if (!Schema::hasColumn('vouchers', 'min_order_amount')) {
                $table->decimal('min_order_amount', 10, 2)->nullable()->after('value');
            }

            if (!Schema::hasColumn('vouchers', 'max_discount_amount')) {
                $table->decimal('max_discount_amount', 10, 2)->nullable()->after('min_order_amount');
            }

            if (!Schema::hasColumn('vouchers', 'start_at')) {
                $table->timestamp('start_at')->nullable()->after('max_discount_amount');
            }

            if (!Schema::hasColumn('vouchers', 'end_at')) {
                $table->timestamp('end_at')->nullable()->after('start_at');
            }

            if (!Schema::hasColumn('vouchers', 'usage_limit_total')) {
                $table->unsignedInteger('usage_limit_total')->nullable()->after('end_at');
            }

            if (!Schema::hasColumn('vouchers', 'usage_limit_per_customer')) {
                $table->unsignedInteger('usage_limit_per_customer')->nullable()->after('usage_limit_total');
            }

            if (!Schema::hasColumn('vouchers', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('usage_limit_per_customer');
            }
        });

        // Backfill new fields from legacy columns when possible
        if (Schema::hasColumn('vouchers', 'value') && Schema::hasColumn('vouchers', 'amount')) {
            DB::table('vouchers')
                ->whereNull('value')
                ->update(['value' => DB::raw('amount')]);
        }

        if (Schema::hasColumn('vouchers', 'usage_limit_total') && Schema::hasColumn('vouchers', 'max_uses')) {
            DB::table('vouchers')
                ->whereNull('usage_limit_total')
                ->update(['usage_limit_total' => DB::raw('max_uses')]);
        }

        if (Schema::hasColumn('vouchers', 'usage_limit_per_customer') && Schema::hasColumn('vouchers', 'max_uses_per_customer')) {
            DB::table('vouchers')
                ->whereNull('usage_limit_per_customer')
                ->update(['usage_limit_per_customer' => DB::raw('max_uses_per_customer')]);
        }
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('vouchers', 'value')) {
                $table->dropColumn('value');
            }

            if (Schema::hasColumn('vouchers', 'max_discount_amount')) {
                $table->dropColumn('max_discount_amount');
            }

            if (Schema::hasColumn('vouchers', 'usage_limit_total')) {
                $table->dropColumn('usage_limit_total');
            }

            if (Schema::hasColumn('vouchers', 'usage_limit_per_customer')) {
                $table->dropColumn('usage_limit_per_customer');
            }
        });
    }
};
