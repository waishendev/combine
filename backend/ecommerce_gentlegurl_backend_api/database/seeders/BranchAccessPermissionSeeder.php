<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use App\Services\StoreLocationAccessService;
use Illuminate\Database\Seeder;

class BranchAccessPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Branch Access'],
            ['sort_order' => ((int) PermissionGroup::max('sort_order')) + 1]
        );

        $permissions = collect(['branch_access.view', 'branch_access.assign'])
            ->map(fn (string $slug) => Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => ucwords(str_replace(['_', '.'], ' ', $slug)),
                    'description' => null,
                    'group_id' => $group->id,
                ]
            ));

        Role::where('name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissions->pluck('id')->all()));
    }
}
