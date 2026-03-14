<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $groups = [
            'users' => 'Users',
            'admins' => 'Admins',
            'roles' => 'Roles',
            'permissions' => 'Permissions',
            'permission-groups' => 'Permission Groups',
            'customers' => 'Customers',
            'staff' => 'Staff',
            'ecommerce.categories' => 'Ecommerce Categories',
            'ecommerce.products' => 'Ecommerce Products',
            'ecommerce.shop-menu' => 'Ecommerce Shop Menu',
            'ecommerce.services-menu' => 'Ecommerce Services Menu',
            'ecommerce.services-pages' => 'Ecommerce Services Pages',
            'ecommerce.stores' => 'Ecommerce Stores',
            'ecommerce.seo' => 'Ecommerce SEO',
            'ecommerce.bank-accounts' => 'Ecommerce Manual Bank Account Transafer',
            'ecommerce.payment-gateways' => 'Ecommerce Payment Gateways',
            'ecommerce.announcements' => 'Ecommerce Announcements',
            'ecommerce.marquees' => 'Ecommerce Marquee',
            'ecommerce.sliders' => 'Ecommerce Sliders',
            'ecommerce.loyalty' => 'Ecommerce Loyalty',
            'ecommerce.notifications' => 'Ecommerce Notifications',
            'ecommerce.loyalty.settings' => 'Ecommerce Loyalty Settings',
            'ecommerce.loyalty.tiers' => 'Ecommerce Loyalty Tiers',
            'ecommerce.vouchers' => 'Ecommerce Vouchers',
            'ecommerce.promotions' => 'Ecommerce Promotions',
            'ecommerce.loyalty.rewards' => 'Ecommerce Loyalty Rewards',
            'ecommerce.loyalty.redemptions' => 'Ecommerce Loyalty Redemptions',
            'ecommerce.reports.sales' => 'Ecommerce Sales Reports',
            'reports.my-pos-summary' => 'My POS Summary Reports',
            'reports.pos-summary' => 'POS Summary Reports',
            'ecommerce.notifications.templates' => 'Ecommerce Notification Templates',
            'ecommerce.dashboard' => 'Ecommerce Dashboard',
            'ecommerce.settings' => 'Ecommerce Settings',
            'ecommerce.orders' => 'Ecommerce Orders',
            'pos' => 'POS',
            'ecommerce.returns' => 'Ecommerce Returns',
            'booking' => 'Booking',
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
            'admins' => ['manage-system'],
            'roles' => ['view', 'view-all', 'manage-system', 'create', 'update', 'delete'],
            'permissions' => ['view', 'create', 'update', 'delete'],
            'permission-groups' => ['view', 'create', 'update', 'delete'],
            'customers' => ['view', 'create', 'update', 'delete', 'verify'],
            'staff' => ['view', 'create', 'update', 'delete'],
            'ecommerce.categories' => ['view', 'create', 'update', 'delete'],
            'ecommerce.products' => ['view', 'create', 'update', 'delete'],
            'ecommerce.shop-menu' => ['view', 'create', 'update', 'delete'],
            'ecommerce.services-menu' => ['view', 'create', 'update', 'delete'],
            'ecommerce.services-pages' => ['view', 'create', 'update', 'delete', 'preview'],
            'ecommerce.marquees' => ['view', 'create', 'update', 'delete'],
            'ecommerce.sliders' => ['view', 'create', 'update', 'delete'],
            'ecommerce.stores' => ['view', 'create', 'update', 'delete'],
            'ecommerce.seo' => ['view', 'update'],
            'ecommerce.bank-accounts' => ['view', 'create', 'update', 'delete'],
            'ecommerce.payment-gateways' => ['view', 'create', 'update', 'delete'],
            'ecommerce.announcements' => ['view', 'create', 'update', 'delete'],
            'ecommerce.orders' => ['view', 'create', 'update', 'confirm-payment'],
            'pos' => ['checkout', 'orders.view'],
            'ecommerce.returns' => ['view', 'update'],
            'ecommerce.loyalty' => ['settings', 'tiers'],
            'ecommerce.loyalty.settings' => ['view', 'create', 'update', 'delete', 'settings', 'tiers'],
            'ecommerce.loyalty.tiers' => ['view', 'create','edit', 'update', 'delete'],
            'ecommerce.loyalty.rewards' => ['view', 'create', 'update', 'delete'],
            'ecommerce.loyalty.redemptions' => ['view', 'update'],
            'ecommerce.notifications' => ['templates'],
            'ecommerce.notifications.templates' => ['view', 'create', 'update', 'delete'],
            'ecommerce.vouchers' => ['view', 'create', 'update', 'delete', 'assign', 'assign.logs.view'],
            'ecommerce.promotions' => ['view', 'create', 'update', 'delete'],
            'ecommerce.reports.sales' => ['view', 'export'],
            'reports.my-pos-summary' => ['view'],
            'reports.pos-summary' => ['view'],
            'ecommerce.dashboard' => ['view'],
            'ecommerce.settings' => ['view', 'update'],
            'booking' => [
                'appointments.view',
                'appointments.update_status',
                'appointments.reschedule',
                'services.view',
                'services.create',
                'services.update',
                'services.delete',
                'schedules.view',
                'schedules.create',
                'schedules.update',
                'schedules.delete',
                'blocks.view',
                'blocks.create',
                'blocks.update',
                'blocks.delete',
                'reports.view',
                'logs.view',
                'settings.view',
                'settings.update',
                'seo.view',
            ],
        ];

        foreach ($definitions as $module => $actions) {
            foreach ($actions as $action) {
                $slug = "{$module}.{$action}";

                Permission::firstOrCreate(
                    ['slug' => $slug],
                    [
                        'name' => ucfirst($module).' '.ucfirst($action),
                        'description' => null,
                        'group_id' => $groupModels[$module]->id ?? null,
                    ]
                );
            }
        }
    }
}
