<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class StaffSalesReportPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'ecommerce.reports.sales.staff.view' => 'Sales Report Staff Card View',
    ];

    public const ADMIN_ROLE_NAMES = [
        'infra_core_x1',
        'superAdmin',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Ecommerce Sales Reports'],
            ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]
        );

        $permissionIds = [];

        foreach (self::PERMISSIONS as $slug => $name) {
            $permission = Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => 'Allows viewing the Staff sales activity card in the sales reports.',
                    'group_id' => $group->id,
                ]
            );

            $permissionIds[] = $permission->id;
        }

        Role::whereIn('name', self::ADMIN_ROLE_NAMES)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissionIds));

        $this->command?->info('Staff sales report permission synced safely.');
    }
}
