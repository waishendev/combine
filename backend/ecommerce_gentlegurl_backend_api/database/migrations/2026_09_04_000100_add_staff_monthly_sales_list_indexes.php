<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * NEW ENHANCEMENT — booking-ecommerce-commissions-query-v1
 * List sort / staff filter coverage for staff_monthly_sales.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS staff_monthly_sales_type_period_desc_index ON staff_monthly_sales (type, year DESC, month DESC)');
            DB::statement('CREATE INDEX IF NOT EXISTS staff_monthly_sales_type_staff_period_index ON staff_monthly_sales (type, staff_id, year DESC, month DESC)');
            return;
        }

        Schema::table('staff_monthly_sales', function (Blueprint $table) {
            $table->index(['type', 'year', 'month'], 'staff_monthly_sales_type_period_desc_index');
            $table->index(['type', 'staff_id', 'year', 'month'], 'staff_monthly_sales_type_staff_period_index');
        });
    }

    public function down(): void
    {
        Schema::table('staff_monthly_sales', function (Blueprint $table) {
            $table->dropIndex('staff_monthly_sales_type_period_desc_index');
            $table->dropIndex('staff_monthly_sales_type_staff_period_index');
        });
    }
};
