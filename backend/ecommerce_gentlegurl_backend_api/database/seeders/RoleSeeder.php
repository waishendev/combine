<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminRole = Role::firstOrCreate(
            ['name' => 'infra_core_x1'],
            [
                'description' => 'Full access to all admin features',
                'is_active' => true,
                'is_system' => true,
            ]
        );

        // 获取所有权限并分配给超级管理员角色
        $allPermissionIds = Permission::pluck('id')->toArray();
        $superAdminRole->permissions()->sync($allPermissionIds);
    }
}

