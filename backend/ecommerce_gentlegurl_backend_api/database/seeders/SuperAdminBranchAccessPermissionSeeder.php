<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class SuperAdminBranchAccessPermissionSeeder extends Seeder
{
    public const ROLE_NAME = 'superAdmin';

    public const PERMISSION_SLUGS = [
        'branch_access.view',
        'branch_access.assign',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Branch Access'],
            ['sort_order' => ((int) PermissionGroup::query()->max('sort_order')) + 1]
        );

        $permissionIds = collect(self::PERMISSION_SLUGS)
            ->map(fn (string $slug) => Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => ucwords(str_replace(['_', '.'], ' ', $slug)),
                    'description' => null,
                    'group_id' => $group->id,
                ]
            )->id)
            ->all();

        $role = Role::query()->where('name', self::ROLE_NAME)->first();

        if (! $role) {
            $this->command?->warn('Role superAdmin was not found; no permissions were assigned.');

            return;
        }

        $role->permissions()->syncWithoutDetaching($permissionIds);

        $this->command?->info('Branch access permissions synced to superAdmin.');
    }
}
