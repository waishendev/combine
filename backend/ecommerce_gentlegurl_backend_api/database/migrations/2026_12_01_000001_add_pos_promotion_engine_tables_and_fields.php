<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            if (!Schema::hasColumn('promotions', 'name')) {
                $table->string('name')->nullable()->after('title');
            }
            if (!Schema::hasColumn('promotions', 'code')) {
                $table->string('code')->nullable()->after('name');
            }
            if (!Schema::hasColumn('promotions', 'description')) {
                $table->text('description')->nullable()->after('code');
            }
            if (!Schema::hasColumn('promotions', 'promotion_type')) {
                $table->string('promotion_type')->nullable()->after('description');
            }
            if (!Schema::hasColumn('promotions', 'trigger_type')) {
                $table->string('trigger_type')->nullable()->after('promotion_type');
            }
            if (!Schema::hasColumn('promotions', 'priority')) {
                $table->integer('priority')->default(0)->after('trigger_type');
            }
            if (!Schema::hasColumn('promotions', 'starts_at')) {
                $table->timestamp('starts_at')->nullable()->after('priority');
            }
            if (!Schema::hasColumn('promotions', 'ends_at')) {
                $table->timestamp('ends_at')->nullable()->after('starts_at');
            }
        });

        Schema::create('promotion_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->timestamps();

            $table->unique('product_id');
            $table->unique(['promotion_id', 'product_id']);
        });

        Schema::create('promotion_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->unsignedInteger('min_qty')->nullable();
            $table->decimal('min_amount', 12, 2)->nullable();
            $table->string('discount_type');
            $table->decimal('discount_value', 12, 2);
            $table->timestamps();

            $table->unique(['promotion_id', 'min_qty']);
            $table->unique(['promotion_id', 'min_amount']);
        });

        Schema::table('pos_cart_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_cart_items', 'discount_type')) {
                $table->string('discount_type')->nullable()->after('price_snapshot');
            }
            if (!Schema::hasColumn('pos_cart_items', 'discount_value')) {
                $table->decimal('discount_value', 12, 2)->default(0)->after('discount_type');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'discount_type')) {
                $table->string('discount_type')->nullable()->after('is_staff_free_applied');
            }
            if (!Schema::hasColumn('order_items', 'discount_value')) {
                $table->decimal('discount_value', 12, 2)->default(0)->after('discount_type');
            }
            if (!Schema::hasColumn('order_items', 'discount_amount')) {
                $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_value');
            }
            if (!Schema::hasColumn('order_items', 'line_total_after_discount')) {
                $table->decimal('line_total_after_discount', 12, 2)->nullable()->after('discount_amount');
            }
            if (!Schema::hasColumn('order_items', 'promotion_id')) {
                $table->foreignId('promotion_id')->nullable()->after('line_total_after_discount')->constrained('promotions')->nullOnDelete();
            }
            if (!Schema::hasColumn('order_items', 'promotion_name_snapshot')) {
                $table->string('promotion_name_snapshot')->nullable()->after('promotion_id');
            }
            if (!Schema::hasColumn('order_items', 'promotion_type_snapshot')) {
                $table->string('promotion_type_snapshot')->nullable()->after('promotion_name_snapshot');
            }
            if (!Schema::hasColumn('order_items', 'promotion_discount_amount')) {
                $table->decimal('promotion_discount_amount', 12, 2)->default(0)->after('promotion_type_snapshot');
            }
            if (!Schema::hasColumn('order_items', 'promotion_applied')) {
                $table->boolean('promotion_applied')->default(false)->after('promotion_discount_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            foreach (['promotion_applied','promotion_discount_amount','promotion_type_snapshot','promotion_name_snapshot'] as $column) {
                if (Schema::hasColumn('order_items', $column)) {
                    $table->dropColumn($column);
                }
            }
            if (Schema::hasColumn('order_items', 'promotion_id')) {
                $table->dropConstrainedForeignId('promotion_id');
            }
            foreach (['line_total_after_discount','discount_amount','discount_value','discount_type'] as $column) {
                if (Schema::hasColumn('order_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('pos_cart_items', function (Blueprint $table) {
            foreach (['discount_type','discount_value'] as $column) {
                if (Schema::hasColumn('pos_cart_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::dropIfExists('promotion_tiers');
        Schema::dropIfExists('promotion_products');

        Schema::table('promotions', function (Blueprint $table) {
            foreach (['name','code','description','promotion_type','trigger_type','priority','starts_at','ends_at'] as $column) {
                if (Schema::hasColumn('promotions', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
