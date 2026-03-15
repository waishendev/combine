<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AddServicePackagePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::query()->firstOrCreate(['name' => 'Booking'], ['sort_order' => 999]);

        $slugs = [
            'service-packages.view',
            'service-packages.create',
            'service-packages.update',
            'service-packages.delete',
            'customer-service-packages.view',
            'customer-service-packages.update',
            'booking.services.view',
            'booking.services.update',
        ];

        $permissionIds = [];
        foreach ($slugs as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => ucwords(str_replace(['-', '.'], ' ', $slug)), 'group_id' => $group->id]
            );
            $permissionIds[] = $permission->id;
        }

        $superAdmin = Role::query()->where('name', 'infra_core_x1')->first();
        if ($superAdmin && !empty($permissionIds)) {
            $superAdmin->permissions()->syncWithoutDetaching($permissionIds);
        }
    }
}
