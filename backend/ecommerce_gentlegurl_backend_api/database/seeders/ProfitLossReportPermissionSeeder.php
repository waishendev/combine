<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ProfitLossReportPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(['name' => 'Ecommerce Sales Reports']);
        $permission = Permission::updateOrCreate(
            ['slug' => 'ecommerce.reports.profit-loss.view'],
            ['name' => 'View Profit & Loss Report', 'description' => 'View the monthly Profit & Loss report.', 'group_id' => $group->id]
        );

        Role::query()->whereIn('name', ['infra_core_x1', 'superAdmin'])->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id]));

        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }
}
