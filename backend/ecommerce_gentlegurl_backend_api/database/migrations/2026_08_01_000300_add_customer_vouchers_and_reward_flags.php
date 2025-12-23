<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voucher_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_redemption_id')->nullable()->constrained('loyalty_redemptions')->nullOnDelete();
            $table->string('status', 20)->default('active');
            $table->timestamp('claimed_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'is_reward_only')) {
                $table->boolean('is_reward_only')->default(false)->after('is_featured');
            }
        });

        Schema::table('cart_items', function (Blueprint $table) {
            if (!Schema::hasColumn('cart_items', 'is_reward')) {
                $table->boolean('is_reward')->default(false)->after('unit_price_snapshot');
            }
            if (!Schema::hasColumn('cart_items', 'reward_redemption_id')) {
                $table->foreignId('reward_redemption_id')
                    ->nullable()
                    ->after('is_reward')
                    ->constrained('loyalty_redemptions')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('cart_items', 'locked')) {
                $table->boolean('locked')->default(false)->after('reward_redemption_id');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'is_reward')) {
                $table->boolean('is_reward')->default(false)->after('line_total');
            }
            if (!Schema::hasColumn('order_items', 'reward_redemption_id')) {
                $table->foreignId('reward_redemption_id')
                    ->nullable()
                    ->after('is_reward')
                    ->constrained('loyalty_redemptions')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('order_items', 'locked')) {
                $table->boolean('locked')->default(false)->after('reward_redemption_id');
            }
        });

        Schema::table('order_vouchers', function (Blueprint $table) {
            if (!Schema::hasColumn('order_vouchers', 'customer_voucher_id')) {
                $table->foreignId('customer_voucher_id')
                    ->nullable()
                    ->after('voucher_id')
                    ->constrained('customer_vouchers')
                    ->nullOnDelete();
            }
        });

        Schema::table('voucher_usages', function (Blueprint $table) {
            if (!Schema::hasColumn('voucher_usages', 'customer_voucher_id')) {
                $table->foreignId('customer_voucher_id')
                    ->nullable()
                    ->after('voucher_id')
                    ->constrained('customer_vouchers')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('voucher_usages', 'discount_amount')) {
                $table->decimal('discount_amount', 12, 2)->nullable()->after('order_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('voucher_usages', function (Blueprint $table) {
            if (Schema::hasColumn('voucher_usages', 'discount_amount')) {
                $table->dropColumn('discount_amount');
            }
            if (Schema::hasColumn('voucher_usages', 'customer_voucher_id')) {
                $table->dropConstrainedForeignId('customer_voucher_id');
            }
        });

        Schema::table('order_vouchers', function (Blueprint $table) {
            if (Schema::hasColumn('order_vouchers', 'customer_voucher_id')) {
                $table->dropConstrainedForeignId('customer_voucher_id');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'locked')) {
                $table->dropColumn('locked');
            }
            if (Schema::hasColumn('order_items', 'reward_redemption_id')) {
                $table->dropConstrainedForeignId('reward_redemption_id');
            }
            if (Schema::hasColumn('order_items', 'is_reward')) {
                $table->dropColumn('is_reward');
            }
        });

        Schema::table('cart_items', function (Blueprint $table) {
            if (Schema::hasColumn('cart_items', 'locked')) {
                $table->dropColumn('locked');
            }
            if (Schema::hasColumn('cart_items', 'reward_redemption_id')) {
                $table->dropConstrainedForeignId('reward_redemption_id');
            }
            if (Schema::hasColumn('cart_items', 'is_reward')) {
                $table->dropColumn('is_reward');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'is_reward_only')) {
                $table->dropColumn('is_reward_only');
            }
        });

        Schema::dropIfExists('customer_vouchers');
    }
};
