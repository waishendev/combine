<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
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
        $allPermissionIds = \App\Models\Permission::pluck('id')->toArray();
        $adminRole->permissions()->sync($allPermissionIds);

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

