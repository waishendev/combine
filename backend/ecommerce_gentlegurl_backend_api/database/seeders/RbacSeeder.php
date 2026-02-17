<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminUser = User::firstOrCreate(
            ['email' => 'infrax1@example.com'],
            [
                'name' => 'Infra Core X1',
                'username' => 'infrax1',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $superAdminRole = Role::firstOrCreate(
            ['name' => 'infra_core_x1'],
            [
                'description' => 'Full access to all admin features',
                'is_active' => true,
                'is_system' => true,
            ]
        );

        $groups = [
            'users' => 'Users',
            'roles' => 'Roles',
            'permissions' => 'Permissions',
            'permission-groups' => 'Permission Groups',
            'customers' => 'Customers',
            'ecommerce.categories' => 'Ecommerce Categories',
            'ecommerce.products' => 'Ecommerce Products',
            'ecommerce.shop-menu' => 'Ecommerce Shop Menu',
            'ecommerce.services-menu' => 'Ecommerce Services Menu',
            'ecommerce.services-pages' => 'Ecommerce Services Pages',
            'ecommerce.stores' => 'Ecommerce Stores',
            'ecommerce.seo' => 'Ecommerce SEO',
            'ecommerce.announcements' => 'Ecommerce Announcements',
            'ecommerce.marquees' => 'Ecommerce Marquee',
            'ecommerce.sliders' => 'Ecommerce Sliders',
            'ecommerce.loyalty' => 'Ecommerce Loyalty',
            'ecommerce.notifications' => 'Ecommerce Notifications',
            'ecommerce.loyalty.settings' => 'Ecommerce Loyalty Settings',
            'ecommerce.loyalty.tiers' => 'Ecommerce Loyalty Tiers',
            'ecommerce.vouchers' => 'Ecommerce Vouchers',
            'ecommerce.loyalty.rewards' => 'Ecommerce Loyalty Rewards',
            'ecommerce.loyalty.redemptions' => 'Ecommerce Loyalty Redemptions',
            'ecommerce.reports.sales' => 'Ecommerce Sales Reports',
            'ecommerce.notifications.templates' => 'Ecommerce Notification Templates',
            'ecommerce.dashboard' => 'Ecommerce Dashboard',
            'ecommerce.settings' => 'Ecommerce Settings',
            'ecommerce.orders' => 'Ecommerce Orders',
        ];

        $groupModels = [];
        $sortOrder = 1;

        foreach ($groups as $key => $name) {
            $groupModels[$key] = PermissionGroup::firstOrCreate(
                ['name' => $name],
                ['sort_order' => $sortOrder++]
            );
        }

        $definitions = [
            'users' => ['view', 'create', 'update', 'delete'],
            'roles' => ['view', 'create', 'update', 'delete'],
            'permissions' => ['view', 'create', 'update', 'delete'],
            'permission-groups' => ['view', 'create', 'update', 'delete'],
            'customers' => ['view', 'create', 'update', 'delete', 'verify'],
            'ecommerce.categories' => ['view', 'create', 'update', 'delete'],
            'ecommerce.products' => ['view', 'create', 'update', 'delete'],
            'ecommerce.shop-menu' => ['view', 'create', 'update', 'delete'],
            'ecommerce.services-menu' => ['view', 'create', 'update', 'delete'],
            'ecommerce.services-pages' => ['view', 'create', 'update', 'delete', 'preview'],
            'ecommerce.marquees' => ['view', 'create', 'update', 'delete'],
            'ecommerce.sliders' => ['view', 'create', 'update', 'delete'],
            'ecommerce.stores' => ['view', 'create', 'update', 'delete'],
            'ecommerce.seo' => ['view', 'update'],
            'ecommerce.announcements' => ['view', 'create', 'update', 'delete'],
            'ecommerce.loyalty' => ['settings', 'tiers'],
            'ecommerce.loyalty.settings' => ['view', 'create', 'update', 'delete', 'settings', 'tiers'],
            'ecommerce.loyalty.tiers' => ['view', 'edit', 'update', 'delete'],
            'ecommerce.loyalty.rewards' => ['view', 'create', 'update', 'delete'],
            'ecommerce.loyalty.redemptions' => ['view', 'update'],
            'ecommerce.notifications' => ['templates'],
            'ecommerce.notifications.templates' => ['view', 'create', 'update', 'delete'],
            'ecommerce.vouchers' => ['view', 'create', 'update', 'delete', 'assign', 'assign.logs.view'],
            'ecommerce.reports.sales' => ['view', 'export'],
            'ecommerce.dashboard' => ['view'],
            'ecommerce.settings' => ['view', 'update'],
            'ecommerce.orders' => ['view', 'create', 'update', 'confirm-payment'],
        ];

        $allPermissionIds = [];

        foreach ($definitions as $module => $actions) {
            foreach ($actions as $action) {
                $slug = "{$module}.{$action}";

                $permission = Permission::firstOrCreate(
                    ['slug' => $slug],
                    [
                        'name' => ucfirst($module).' '.ucfirst($action),
                        'description' => null,
                        'group_id' => $groupModels[$module]->id ?? null,
                    ]
                );

                $allPermissionIds[] = $permission->id;
            }
        }

        $superAdminRole->permissions()->sync($allPermissionIds);

        $superAdminUser->roles()->syncWithoutDetaching([$superAdminRole->id]);


        $staffRole = Role::firstOrCreate(
            ['name' => 'staff'],
            [
                'description' => 'POS staff role',
                'is_active' => true,
            ]
        );

        $staffPermissionIds = Permission::whereIn('slug', [
            'ecommerce.orders.create',
            'ecommerce.orders.view',
            'customers.view',
            'ecommerce.products.view',
        ])->pluck('id')->all();

        $staffRole->permissions()->sync($staffPermissionIds);

        $staffUser = User::firstOrCreate(
            ['email' => 'staff@example.com'],
            [
                'name' => 'POS Staff',
                'username' => 'pos_staff',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $staffUser->roles()->syncWithoutDetaching([$staffRole->id]);
    }
}
