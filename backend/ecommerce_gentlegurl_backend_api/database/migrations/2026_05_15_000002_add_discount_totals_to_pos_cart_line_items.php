<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addDiscountColumns('pos_cart_items');
        $this->addDiscountColumns('pos_cart_package_items');
    }

    public function down(): void
    {
        $this->dropDiscountColumns('pos_cart_package_items', ['line_total_after_discount', 'discount_amount']);
        $this->dropDiscountColumns('pos_cart_items', ['line_total_after_discount', 'discount_amount']);
    }

    private function addDiscountColumns(string $tableName): void
    {
        if (! Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (! Schema::hasColumn($tableName, 'discount_type')) {
                $table->string('discount_type')->nullable();
            }
            if (! Schema::hasColumn($tableName, 'discount_value')) {
                $table->decimal('discount_value', 12, 2)->nullable()->default(0);
            }
            if (! Schema::hasColumn($tableName, 'discount_amount')) {
                $table->decimal('discount_amount', 12, 2)->nullable()->default(0);
            }
            if (! Schema::hasColumn($tableName, 'discount_remark')) {
                $table->text('discount_remark')->nullable();
            }
            if (! Schema::hasColumn($tableName, 'line_total_after_discount')) {
                $table->decimal('line_total_after_discount', 12, 2)->nullable();
            }
        });

        DB::table($tableName)->whereNull('discount_value')->update(['discount_value' => 0]);
        DB::table($tableName)->whereNull('discount_amount')->update(['discount_amount' => 0]);
    }

    private function dropDiscountColumns(string $tableName, array $columns): void
    {
        if (! Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName, $columns) {
            foreach ($columns as $column) {
                if (Schema::hasColumn($tableName, $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
