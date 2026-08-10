<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->boolean('is_online_enabled')->default(true)->after('is_active');
        });

        Schema::create('promotion_store_location', function (Blueprint $table) {
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['promotion_id', 'store_location_id'], 'promotion_store_location_pk');
        });

        // Preserve the existing POS engine semantics using its persisted `pos`
        // display position. This is applicability metadata, not stock movement.
        $posPromotionIds = DB::table('promotions')->where('display_position', 'pos')->pluck('id');
        $branchIds = DB::table('store_locations')->where('is_active', true)->pluck('id');
        $now = now();
        $rows = [];
        foreach ($posPromotionIds as $promotionId) {
            foreach ($branchIds as $branchId) {
                $rows[] = ['promotion_id' => $promotionId, 'store_location_id' => $branchId, 'created_at' => $now, 'updated_at' => $now];
            }
        }
        if ($rows !== []) {
            DB::table('promotion_store_location')->insertOrIgnore($rows);
            DB::table('promotions')->whereIn('id', $posPromotionIds)->update(['is_online_enabled' => false]);
        }

        Schema::create('order_inventory_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('status', 20)->default('reserved');
            $table->string('idempotency_key', 191)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'status']);
            $table->index(['store_location_id', 'product_id', 'product_variant_id'], 'oir_branch_product_variant_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_inventory_reservations');
        Schema::dropIfExists('promotion_store_location');
        Schema::table('promotions', fn (Blueprint $table) => $table->dropColumn('is_online_enabled'));
    }
};
