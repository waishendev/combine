<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('order_item_staff_splits')) {
            return;
        }

        Schema::table('order_item_staff_splits', function (Blueprint $table) {
            try {
                $table->dropUnique('order_item_staff_splits_order_item_id_staff_id_unique');
            } catch (\Throwable $e) {
                // Index may not exist in older installs.
            }

            if (! Schema::hasColumn('order_item_staff_splits', 'line_type')) {
                $table->string('line_type')->nullable()->after('order_item_id');
            }
            if (! Schema::hasColumn('order_item_staff_splits', 'line_ref_id')) {
                $table->string('line_ref_id')->nullable()->after('line_type');
            }
            if (! Schema::hasColumn('order_item_staff_splits', 'amount_basis')) {
                $table->decimal('amount_basis', 12, 2)->nullable()->after('share_percent');
            }
            if (! Schema::hasColumn('order_item_staff_splits', 'snapshot')) {
                $table->json('snapshot')->nullable()->after('commission_rate_snapshot');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('order_item_staff_splits')) {
            return;
        }

        Schema::table('order_item_staff_splits', function (Blueprint $table) {
            try {
                $table->unique(['order_item_id', 'staff_id']);
            } catch (\Throwable $e) {
                // Original unique index may already exist.
            }

            foreach (['snapshot', 'amount_basis', 'line_ref_id', 'line_type'] as $column) {
                if (Schema::hasColumn('order_item_staff_splits', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
