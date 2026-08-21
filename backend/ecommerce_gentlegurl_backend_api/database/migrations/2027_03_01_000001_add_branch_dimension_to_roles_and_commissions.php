<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->foreignId('store_location_id')->nullable()->after('id')
                ->constrained('store_locations')->restrictOnDelete();
            $table->index(['store_location_id', 'is_active']);
        });

        // Existing NULL roles deliberately remain legacy/global. Branch roles may reuse names.
        Schema::table('roles', fn (Blueprint $table) => $table->dropUnique('roles_name_unique'));
        $this->createRoleNameIndexes();

        Schema::create('role_user_store_location', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['user_id', 'store_location_id', 'role_id'], 'role_user_location_primary');
            $table->index(['role_id', 'store_location_id']);
        });

        foreach (['staff_commission_tiers', 'staff_monthly_sales', 'staff_commission_logs'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->foreignId('store_location_id')->nullable()->after('id')
                    ->constrained('store_locations')->restrictOnDelete();
            });
        }

        Schema::table('staff_commission_tiers', function (Blueprint $table) {
            $table->dropUnique('staff_commission_tiers_type_min_sales_unique');
            $table->unique(['store_location_id', 'type', 'min_sales'], 'commission_tiers_branch_type_min_unique');
            $table->index(['store_location_id', 'type', 'min_sales'], 'commission_tiers_branch_lookup');
        });
        Schema::table('staff_monthly_sales', function (Blueprint $table) {
            $table->dropUnique('staff_monthly_sales_type_staff_id_year_month_unique');
            $table->unique(['store_location_id', 'type', 'staff_id', 'year', 'month'], 'staff_monthly_sales_branch_identity');
            $table->index(['store_location_id', 'type', 'year', 'month'], 'staff_monthly_sales_branch_period');
        });
        Schema::table('staff_commission_logs', fn (Blueprint $table) =>
            $table->index(['store_location_id', 'type', 'year', 'month'], 'commission_logs_branch_period'));
    }

    private function createRoleNameIndexes(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX roles_branch_name_unique ON roles (store_location_id, LOWER(name)) WHERE store_location_id IS NOT NULL');
            DB::statement('CREATE UNIQUE INDEX roles_global_name_unique ON roles (LOWER(name)) WHERE store_location_id IS NULL');
        } else {
            Schema::table('roles', fn (Blueprint $table) => $table->unique(['store_location_id', 'name'], 'roles_branch_name_unique'));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user_store_location');
        foreach (['staff_commission_logs', 'staff_monthly_sales', 'staff_commission_tiers'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropConstrainedForeignId('store_location_id'));
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS roles_branch_name_unique');
            DB::statement('DROP INDEX IF EXISTS roles_global_name_unique');
        }
        Schema::table('roles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_location_id');
            $table->unique('name');
        });
    }
};
