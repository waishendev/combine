<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staffs / staff-consumables / commission-tiers query enhancement — P0/P2 indexes.
 * Safe partial + list indexes; no API contract changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'is_staff_free_applied')) {
            DB::statement('CREATE INDEX IF NOT EXISTS order_items_staff_free_applied_id_idx ON order_items (id DESC) WHERE is_staff_free_applied = true');
            DB::statement('CREATE INDEX IF NOT EXISTS order_items_staff_free_applied_order_id_idx ON order_items (order_id, id DESC) WHERE is_staff_free_applied = true');
        }

        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'payment_method')) {
            DB::statement("CREATE INDEX IF NOT EXISTS orders_payment_method_staff_free_idx ON orders (id, created_at) WHERE payment_method = 'staff_free'");
        }

        if (Schema::hasTable('staffs')) {
            DB::statement('CREATE INDEX IF NOT EXISTS staffs_is_active_name_idx ON staffs (is_active, name)');
            if (Schema::hasColumn('staffs', 'email')) {
                DB::statement('CREATE INDEX IF NOT EXISTS staffs_email_idx ON staffs (email) WHERE email IS NOT NULL');
            }
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'staff_id')) {
            DB::statement('CREATE INDEX IF NOT EXISTS users_staff_id_idx ON users (staff_id) WHERE staff_id IS NOT NULL');
        }

        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'staff_id')) {
            DB::statement('CREATE INDEX IF NOT EXISTS order_items_staff_id_idx ON order_items (staff_id) WHERE staff_id IS NOT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS order_items_staff_free_applied_id_idx');
        DB::statement('DROP INDEX IF EXISTS order_items_staff_free_applied_order_id_idx');
        DB::statement('DROP INDEX IF EXISTS orders_payment_method_staff_free_idx');
        DB::statement('DROP INDEX IF EXISTS staffs_is_active_name_idx');
        DB::statement('DROP INDEX IF EXISTS staffs_email_idx');
        DB::statement('DROP INDEX IF EXISTS users_staff_id_idx');
        DB::statement('DROP INDEX IF EXISTS order_items_staff_id_idx');
    }
};
