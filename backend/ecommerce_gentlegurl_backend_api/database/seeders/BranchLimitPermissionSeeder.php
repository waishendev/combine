<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class BranchLimitPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'ecommerce.branch-limit.view' => [
            'name' => 'Branch Limit View',
            'description' => 'View the platform Branch creation limit settings.',
        ],
        'ecommerce.branch-limit.update' => [
            'name' => 'Branch Limit Update',
            'description' => 'Update the platform Branch creation limit settings.',
        ],
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Branch Limit Settings'],
            ['sort_order' => 98]
        );

        $permissionIds = [];
        foreach (self::PERMISSIONS as $slug => $meta) {
            $permission = Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $meta['name'],
                    'description' => $meta['description'],
                    'group_id' => $group->id,
                ]
            );
            $permissionIds[] = $permission->id;
        }

        // Attach to Platform Super Admin (global and any same-named Branch copies).
        Role::query()
            ->whereRaw('LOWER(name) = ?', ['infra_core_x1'])
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissionIds));

        $this->command?->info('Branch Limit permissions synced: ecommerce.branch-limit.view / ecommerce.branch-limit.update');
    }
}
