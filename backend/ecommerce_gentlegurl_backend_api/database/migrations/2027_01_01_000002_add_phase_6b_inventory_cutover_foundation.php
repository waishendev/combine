<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_stock_movements', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('product_variant_id')
                ->constrained()->nullOnDelete();
            $table->nullableMorphs('reference');
            $table->integer('quantity_delta')->nullable()->after('quantity_change');
            $table->string('idempotency_key', 191)->nullable()->unique();
            $table->index(['store_location_id', 'product_id', 'product_variant_id'], 'psm_branch_product_variant_idx');
        });

        Schema::create('branch_inventory_cutover_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_location_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status', 30)->default('pending');
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->json('reconciliation_summary')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_inventory_cutover_states');
        Schema::table('product_stock_movements', function (Blueprint $table) {
            $table->dropIndex('psm_branch_product_variant_idx');
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn('quantity_delta');
            $table->dropMorphs('reference');
            $table->dropConstrainedForeignId('store_location_id');
        });
    }
};
