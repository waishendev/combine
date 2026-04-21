<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CustomerSuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminRole = Role::firstOrCreate(
            ['name' => 'superAdmin'],
            [
                'description' => 'Full access to all admin features',
                'is_active' => true,
                'is_system' => false,
                'is_default' => true,
            ]
        );
        $superAdminRole->is_system = true;
        $superAdminRole->is_default = false;
        $superAdminRole->is_active = true;
        $superAdminRole->save();

        // 给超级管理员几乎全部权限，但排除系统级权限：admins.manage-system
        $excludedPermissionSlugs = [
            'admins.manage-system',
            'ecommerce.billplz-payment-gateways.view',
            'ecommerce.billplz-payment-gateways.create',
            'ecommerce.billplz-payment-gateways.update',
            'ecommerce.billplz-payment-gateways.delete',
        ];
        $permissionIds = Permission::query()
            ->whereNotIn('slug', $excludedPermissionSlugs)
            ->pluck('id')
            ->toArray();
        $superAdminRole->permissions()->sync($permissionIds);

        $superAdminUser = User::firstOrCreate(
            ['email' => 'gentlegurlssuperadmin@example.com'],
            [
                'name' => 'Super Admin User',
                'username' => 'superAdminuser',
                'password' => Hash::make('password'),
                'is_active' => true,
            ]
        );

        $superAdminUser->roles()->syncWithoutDetaching([$superAdminRole->id]);
    }
}
