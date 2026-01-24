<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // 创建管理员角色（或使用现有的角色）
        $adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            [
                'description' => 'Administrator with limited access',
                'is_active' => true,
                'is_system' => false,
            ]
        );

        // 为管理员角色分配基本权限（可以根据需要调整）
        // 这里我们给管理员大部分权限，除了系统级别的权限
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
            'ecommerce.services-pages.update',
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
            'ecommerce.payment-gateways.create',
            'ecommerce.payment-gateways.update',
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
        ];

        $adminPermissionIds = Permission::whereIn('slug', $adminPermissionSlugs)
            ->pluck('id')
            ->toArray();
        $adminRole->permissions()->sync($adminPermissionIds);

        // 创建管理员用户
        $adminUser = User::firstOrCreate(
            ['email' => 'gentlegurlsadmin@example.com'],
            [
                'name' => 'Admin User',
                'username' => 'adminuser',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $adminUser->roles()->syncWithoutDetaching([$adminRole->id]);
    }
}
