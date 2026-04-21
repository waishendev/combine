<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * LIVE-safe RBAC patch seeder.
 *
 * - Does NOT delete/truncate anything
 * - Uses firstOrCreate / syncWithoutDetaching to only ADD missing records/relations
 * - Also seeds missing POS/Staff related permission slugs used by StaffRbacSeeder
 */
class LiveRbacPatchSeeder extends Seeder
{
    public function run(): void
    {
        // ---- 1) Ensure permission groups exist (case-insensitive) ----
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
            'ecommerce.loyalty.rewards' => 'Ecommerce Loyalty Rewards',
            'ecommerce.loyalty.redemptions' => 'Ecommerce Loyalty Redemptions',
            'ecommerce.reports.sales' => 'Ecommerce Sales Reports',
            'ecommerce.notifications.templates' => 'Ecommerce Notification Templates',
            'ecommerce.dashboard' => 'Ecommerce Dashboard',
            'ecommerce.settings' => 'Ecommerce Settings',
            'ecommerce.orders' => 'Ecommerce Orders',
            'ecommerce.returns' => 'Ecommerce Returns',
            'booking' => 'Booking',
            'booking.payment-gateways' => 'Booking Payment Gateways',
            'booking.bank-accounts' => 'Booking Manual Bank Accounts',

            // POS / Staff / Reports (needed by StaffRbacSeeder + POS screens)
            'staff' => 'Staff',
            'pos' => 'POS',
            'pos.orders' => 'POS Orders',
            'reports.my-pos-summary' => 'Reports - My POS Summary',
            'reports.pos-summary' => 'Reports - POS Summary',
        ];

        $groupModels = [];
        $sortOrder = 1;
        foreach ($groups as $key => $name) {
            $group = PermissionGroup::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();

            if (! $group) {
                $group = PermissionGroup::firstOrCreate(
                    ['name' => $name],
                    ['sort_order' => $sortOrder]
                );
            }

            // Keep sort_order stable-ish if it's empty; don't overwrite existing custom ordering.
            if ($group->sort_order === null) {
                $group->sort_order = $sortOrder;
                $group->save();
            }

            $groupModels[$key] = $group;
            $sortOrder++;
        }

        // ---- 2) Ensure permissions exist ----
        // NOTE: This is the same structure as PermissionSeeder, plus POS/Staff slugs.
        $definitions = [
            'users' => ['view', 'create', 'update', 'delete'],
            'roles' => ['view', 'view-all', 'create', 'update', 'delete'],
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
            'ecommerce.bank-accounts' => ['view', 'create', 'update', 'delete'],
            'ecommerce.payment-gateways' => ['view', 'create', 'update', 'delete'],
            'ecommerce.announcements' => ['view', 'create', 'update', 'delete'],
            'ecommerce.orders' => ['view', 'create', 'update', 'confirm-payment'],
            'ecommerce.returns' => ['view', 'update'],
            'ecommerce.loyalty' => ['settings', 'tiers'],
            'ecommerce.loyalty.settings' => ['view', 'create', 'update', 'delete', 'settings', 'tiers'],
            'ecommerce.loyalty.tiers' => ['view', 'create', 'edit', 'update', 'delete'],
            'ecommerce.loyalty.rewards' => ['view', 'create', 'update', 'delete'],
            'ecommerce.loyalty.redemptions' => ['view', 'update'],
            'ecommerce.notifications' => ['templates'],
            'ecommerce.notifications.templates' => ['view', 'create', 'update', 'delete'],
            'ecommerce.vouchers' => ['view', 'create', 'update', 'delete', 'assign', 'assign.logs.view'],
            'ecommerce.reports.sales' => ['view', 'export'],
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

            // POS / Staff / Reports
            'staff' => ['view'],
            'pos' => ['checkout'],
            'pos.orders' => ['view'],
            'reports.my-pos-summary' => ['view'],
            'reports.pos-summary' => ['view'],
        ];

        foreach ($definitions as $module => $actions) {
            foreach ($actions as $action) {
                $slug = "{$module}.{$action}";
                $groupId = $groupModels[$module]->id ?? null;

                $permission = Permission::firstOrCreate(
                    ['slug' => $slug],
                    [
                        'name' => $this->makePermissionName($module, $action),
                        'description' => null,
                        'group_id' => $groupId,
                    ]
                );

                // If permission existed from older seeds but group_id is missing, backfill it.
                if ($permission->group_id === null && $groupId !== null) {
                    $permission->group_id = $groupId;
                    $permission->save();
                }
            }
        }

        // ---- 3) Ensure roles exist + attach permissions (without detaching) ----
        $superAdminRole = $this->firstOrCreateRole('infra_core_x1', [
            'description' => 'Full access to all admin features',
            'is_active' => true,
            'is_system' => true,
            'is_default' => false,
        ]);

        // Give super admin all permissions (only add missing).
        $allPermissionIds = Permission::pluck('id')->all();
        if (! empty($allPermissionIds)) {
            $superAdminRole->permissions()->syncWithoutDetaching($allPermissionIds);
        }

        // Admin role: only add the permission slugs defined in AdminSeeder (do not detach existing).
        $adminRole = $this->firstOrCreateRole('admin', [
            'description' => 'Administrator with limited access',
            'is_active' => true,
            'is_system' => false,
            'is_default' => false,
        ]);

        $adminPermissionSlugs = [
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'customers.view',
            'customers.create',
            'customers.update',
            'customers.delete',
            'customers.verify',
            'ecommerce.categories.view',
            'ecommerce.categories.create',
            'ecommerce.categories.update',
            'ecommerce.categories.delete',
            'ecommerce.products.view',
            'ecommerce.products.create',
            'ecommerce.products.update',
            'ecommerce.products.delete',
            'ecommerce.shop-menu.view',
            'ecommerce.shop-menu.create',
            'ecommerce.shop-menu.update',
            'ecommerce.shop-menu.delete',
            'ecommerce.services-menu.view',
            'ecommerce.services-menu.create',
            'ecommerce.services-menu.update',
            'ecommerce.services-menu.delete',
            'ecommerce.services-pages.view',
            'ecommerce.services-pages.create',
            'ecommerce.services-pages.update',
            'ecommerce.services-pages.delete',
            'ecommerce.services-pages.preview',
            'ecommerce.marquees.view',
            'ecommerce.marquees.create',
            'ecommerce.marquees.update',
            'ecommerce.marquees.delete',
            'ecommerce.sliders.view',
            'ecommerce.sliders.create',
            'ecommerce.sliders.update',
            'ecommerce.sliders.delete',
            'ecommerce.stores.view',
            'ecommerce.stores.create',
            'ecommerce.stores.update',
            'ecommerce.stores.delete',
            'ecommerce.seo.view',
            'ecommerce.seo.update',
            'ecommerce.payment-gateways.view',
            'ecommerce.billplz-payment-gateways.view',
            'ecommerce.billplz-payment-gateways.create',
            'ecommerce.payment-gateways.create',
            'ecommerce.billplz-payment-gateways.update',
            'ecommerce.payment-gateways.update',
            'ecommerce.billplz-payment-gateways.delete',
            'ecommerce.payment-gateways.delete',
            'ecommerce.bank-accounts.view',
            'ecommerce.bank-accounts.create',
            'ecommerce.bank-accounts.update',
            'ecommerce.bank-accounts.delete',
            'ecommerce.announcements.view',
            'ecommerce.announcements.create',
            'ecommerce.announcements.update',
            'ecommerce.announcements.delete',
            'ecommerce.orders.view',
            'ecommerce.orders.update',
            'ecommerce.orders.confirm-payment',
            'ecommerce.returns.view',
            'ecommerce.returns.update',
            'ecommerce.loyalty.settings.view',
            'ecommerce.loyalty.settings.create',
            'ecommerce.loyalty.settings.update',
            'ecommerce.loyalty.settings.delete',
            'ecommerce.loyalty.settings.settings',
            'ecommerce.loyalty.settings.tiers',
            'ecommerce.loyalty.tiers.view',
            'ecommerce.loyalty.tiers.create',
            'ecommerce.loyalty.tiers.update',
            'ecommerce.loyalty.tiers.delete',
            'ecommerce.loyalty.tiers.edit',
            'ecommerce.loyalty.rewards.view',
            'ecommerce.loyalty.rewards.create',
            'ecommerce.loyalty.rewards.update',
            'ecommerce.loyalty.rewards.delete',
            'ecommerce.loyalty.redemptions.view',
            'ecommerce.loyalty.redemptions.update',
            'ecommerce.vouchers.view',
            'ecommerce.vouchers.create',
            'ecommerce.vouchers.update',
            'ecommerce.vouchers.delete',
            'ecommerce.vouchers.assign',
            'ecommerce.vouchers.assign.logs.view',
            'ecommerce.reports.sales.view',
            'ecommerce.reports.sales.export',
            'ecommerce.dashboard.view',
            'ecommerce.dashboard.update',
            'ecommerce.settings.view',
            'ecommerce.settings.update',
            'booking.payment-gateways.view',
            'booking.payment-gateways.create',
            'booking.payment-gateways.update',
            'booking.payment-gateways.delete',
            'booking.bank-accounts.view',
            'booking.bank-accounts.create',
            'booking.bank-accounts.update',
            'booking.bank-accounts.delete',
            'booking.settings.view',
            'booking.seo.view',
        ];

        $adminPermissionIds = Permission::whereIn('slug', $adminPermissionSlugs)->pluck('id')->all();
        if (! empty($adminPermissionIds)) {
            $adminRole->permissions()->syncWithoutDetaching($adminPermissionIds);
        }

        // Staff role: make sure role exists and gets the required POS permissions.
        $staffRole = Role::query()
            ->whereRaw('LOWER(name) = ?', ['staff'])
            ->first();

        if (! $staffRole) {
            $staffRole = Role::create([
                'name' => 'Staff',
                'description' => 'Staff role for POS and limited CRM access',
                'is_active' => true,
                'is_system' => false,
                'is_default' => true,
            ]);
        } else {
            $staffRole->name = 'Staff';
            $staffRole->description = $staffRole->description ?: 'Staff role for POS and limited CRM access';
            $staffRole->is_active = true;
            $staffRole->is_system = false;
            $staffRole->is_default = true;
            $staffRole->save();
        }

        $staffPermissionIds = Permission::whereIn('slug', [
            'staff.view',
            'pos.checkout',
            'pos.orders.view',
            'reports.my-pos-summary.view',
            'reports.pos-summary.view',
        ])->pluck('id')->all();

        if (! empty($staffPermissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($staffPermissionIds);
        }
    }

    private function makePermissionName(string $module, string $action): string
    {
        $prettyModule = ucwords(str_replace(['.', '-', '_'], ' ', $module));
        $prettyAction = ucwords(str_replace(['.', '-', '_'], ' ', $action));

        return trim($prettyModule . ' ' . $prettyAction);
    }

    /**
     * Find a role by name (case-insensitive) or create it.
     */
    private function firstOrCreateRole(string $name, array $defaults): Role
    {
        $existing = Role::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            // Only fill blanks / ensure important flags; do not clobber existing custom descriptions.
            if (empty($existing->description) && ! empty($defaults['description'])) {
                $existing->description = $defaults['description'];
            }
            if (array_key_exists('is_active', $defaults)) {
                $existing->is_active = (bool) $defaults['is_active'];
            }
            if (array_key_exists('is_system', $defaults)) {
                $existing->is_system = (bool) $defaults['is_system'];
            }
            if (array_key_exists('is_default', $defaults) && $existing->is_default === null) {
                $existing->is_default = (bool) $defaults['is_default'];
            }
            if ($existing->isDirty()) {
                $existing->save();
            }
            return $existing;
        }

        return Role::firstOrCreate(['name' => $name], $defaults);
    }
}
