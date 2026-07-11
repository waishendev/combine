<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class DashboardAnalyticsPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'dashboard.analytics.view' => 'Dashboard Analytics View',
        'dashboard.ecommerce_analytics.view' => 'Dashboard Ecommerce Analytics View',
        'dashboard.package_analytics.view' => 'Dashboard Package Analytics View',
    ];

    public const ADMIN_ROLE_NAMES = [
        'infra_core_x1',
        'superAdmin',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Dashboard'],
            ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]
        );

        $permissionIds = [];

        foreach (self::PERMISSIONS as $slug => $name) {
            $permission = Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => 'Allows viewing sensitive dashboard analytics metrics.',
                    'group_id' => $group->id,
                ]
            );

            $permissionIds[] = $permission->id;
        }

        Role::whereIn('name', self::ADMIN_ROLE_NAMES)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissionIds));

        $this->command?->info('Dashboard analytics permissions synced safely.');
    }
}
