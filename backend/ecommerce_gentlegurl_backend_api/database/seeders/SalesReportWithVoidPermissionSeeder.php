<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class SalesReportWithVoidPermissionSeeder extends Seeder
{
    public const PERMISSION_SLUG = 'ecommerce.reports.sales.with-void.view';

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Ecommerce Sales Reports'],
            ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => self::PERMISSION_SLUG],
            [
                'name' => 'Sales Report Including Void View',
                'description' => 'Allows viewing the Sales Report page that includes VOID orders and transactions.',
                'group_id' => $group->id,
            ]
        );

        $infraRole = Role::firstOrCreate(
            ['name' => 'infra_core_x1'],
            [
                'description' => 'Full access to all admin features',
                'is_active' => true,
                'is_system' => true,
                'is_default' => false,
            ]
        );

        $infraRole->permissions()->syncWithoutDetaching([$permission->id]);

        $this->command?->info('Sales report including void permission synced for infra_core_x1.');
    }
}
