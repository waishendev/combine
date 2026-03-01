<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class SuperAdminRoleSeeder extends Seeder
{
    public function run(): void
    {
        $superAdminRole = Role::firstOrCreate(
            ['name' => 'infra_core_x1'],
            [
                'description' => 'Full access to all admin features',
                'is_active' => true,
                'is_system' => true,
                'is_default' => false,
            ]
        );
        $superAdminRole->is_system = true;
        $superAdminRole->is_default = false;
        $superAdminRole->save();

        // 获取所有权限并分配给超级管理员角色
        $manageSystemPermission = Permission::firstOrCreate(
            ['slug' => 'admins.manage-system'],
            [
                'name' => 'Admins Manage-system',
                'description' => null,
                'group_id' => null,
            ]
        );

        $allPermissionIds = Permission::pluck('id')->toArray();
        $superAdminRole->permissions()->sync(array_values(array_unique(array_merge($allPermissionIds, [$manageSystemPermission->id]))));
    }
}
