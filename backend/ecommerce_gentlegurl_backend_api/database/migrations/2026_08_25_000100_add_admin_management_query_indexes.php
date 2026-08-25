<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin management query enhancement — P0 indexes.
 * Pages: CRM /admins, /roles, /permission, /permission-groups
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        if (Schema::hasTable('role_user')) {
            DB::statement('CREATE INDEX IF NOT EXISTS role_user_user_id_idx ON role_user (user_id)');
        }

        if (Schema::hasTable('permission_role')) {
            DB::statement('CREATE INDEX IF NOT EXISTS permission_role_role_id_idx ON permission_role (role_id)');
        }

        if (Schema::hasTable('permission_groups')) {
            DB::statement('CREATE INDEX IF NOT EXISTS permission_groups_sort_order_idx ON permission_groups (sort_order)');
        }

        if (Schema::hasTable('roles')) {
            DB::statement('CREATE INDEX IF NOT EXISTS roles_is_system_idx ON roles (is_system)');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS role_user_user_id_idx');
        DB::statement('DROP INDEX IF EXISTS permission_role_role_id_idx');
        DB::statement('DROP INDEX IF EXISTS permission_groups_sort_order_idx');
        DB::statement('DROP INDEX IF EXISTS roles_is_system_idx');
    }
};
