<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Expense / expense-categories query enhancement — P0 indexes.
 *
 * Supports CRM /expenses and /expense-categories list filters, sorting, and withCount.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (Schema::hasTable('expenses')) {
            DB::statement('
                CREATE INDEX IF NOT EXISTS expenses_live_branch_date_id_idx
                ON expenses (store_location_id, expense_date DESC, id DESC)
                WHERE deleted_at IS NULL
            ');
            DB::statement('
                CREATE INDEX IF NOT EXISTS expenses_live_branch_category_date_id_idx
                ON expenses (store_location_id, expense_category_id, expense_date DESC, id DESC)
                WHERE deleted_at IS NULL
            ');
            DB::statement('
                CREATE INDEX IF NOT EXISTS expenses_live_category_id_idx
                ON expenses (expense_category_id)
                WHERE deleted_at IS NULL
            ');
        }

        if (Schema::hasTable('expense_categories')) {
            DB::statement('
                CREATE INDEX IF NOT EXISTS expense_categories_branch_sort_name_idx
                ON expense_categories (store_location_id, sort_order, name)
            ');
            DB::statement('
                CREATE INDEX IF NOT EXISTS expense_categories_branch_active_sort_idx
                ON expense_categories (store_location_id, is_active, sort_order)
            ');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS expenses_live_branch_date_id_idx');
        DB::statement('DROP INDEX IF EXISTS expenses_live_branch_category_date_id_idx');
        DB::statement('DROP INDEX IF EXISTS expenses_live_category_id_idx');
        DB::statement('DROP INDEX IF EXISTS expense_categories_branch_sort_name_idx');
        DB::statement('DROP INDEX IF EXISTS expense_categories_branch_active_sort_idx');
    }
};
