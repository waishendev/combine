<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AddRoleViewAllAndServicesPagesPreviewSeeder extends Seeder
{
    public function run(): void
    {
        $rolesGroup = PermissionGroup::firstOrCreate(['name' => 'Roles']);
        $servicesPagesGroup = PermissionGroup::firstOrCreate(['name' => 'Ecommerce Services Pages']);

        $permissions = [
            [
                'slug' => 'roles.view-all',
                'name' => 'Roles View All',
                'group_id' => $rolesGroup->id,
            ],
            [
                'slug' => 'ecommerce.services-pages.preview',
                'name' => 'Ecommerce Services Pages Preview',
                'group_id' => $servicesPagesGroup->id,
            ],
        ];

        $permissionIds = [];

        foreach ($permissions as $definition) {
            $permission = Permission::firstOrCreate(
                ['slug' => $definition['slug']],
                [
                    'name' => $definition['name'],
                    'description' => null,
                    'group_id' => $definition['group_id'],
                ]
            );
            $permissionIds[] = $permission->id;
        }

        $superAdminRole = Role::where('name', 'infra_core_x1')->first();

        if ($superAdminRole) {
            $superAdminRole->permissions()->syncWithoutDetaching($permissionIds);
        }
    }
}
