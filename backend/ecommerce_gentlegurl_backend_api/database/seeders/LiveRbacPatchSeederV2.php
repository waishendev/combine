<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * LIVE-safe RBAC patch (v2).
 *
 * Purpose: add missing permission slugs that are referenced by routes/controllers
 * but may not exist yet in LIVE DB, then grant them to infra_core_x1.
 *
 * - firstOrCreate only (no deletes)
 * - syncWithoutDetaching only (no detach)
 */
class LiveRbacPatchSeederV2 extends Seeder
{
    public function run(): void
    {
        // Ensure groups exist (names aligned with PermissionSeeder.php)
        $groups = [
            'admins' => 'Admins',
            'roles' => 'Roles',
            'staff' => 'Staff',
        ];

        $groupModels = [];
        $sortOrder = 1;
        foreach ($groups as $key => $name) {
            $groupModels[$key] = PermissionGroup::firstOrCreate(
                ['name' => $name],
                ['sort_order' => $sortOrder++]
            );
        }

        // Slugs to ensure exist + which group they belong to
        $slugs = [
            // system admin controls
            'admins.manage-system' => 'admins',
            'roles.manage-system' => 'roles',

            // staff module (used by StaffController routes)
            // 'staff.view' => 'staff',
            'staff.create' => 'staff',
            'staff.update' => 'staff',
            'staff.delete' => 'staff',

        ];

        $createdPermissionIds = [];

        foreach ($slugs as $slug => $groupKey) {
            $groupId = $groupModels[$groupKey]->id ?? null;

            $permission = Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $this->makeNameFromSlug($slug),
                    'description' => null,
                    'group_id' => $groupId,
                ]
            );

            // Backfill group_id if old record had null
            if ($permission->group_id === null && $groupId !== null) {
                $permission->group_id = $groupId;
                $permission->save();
            }

            $createdPermissionIds[] = $permission->id;
        }

        // Grant to infra_core_x1
        $infraRole = Role::query()->where('name', 'infra_core_x1')->first();
        if (! $infraRole) {
            $infraRole = Role::firstOrCreate(
                ['name' => 'infra_core_x1'],
                [
                    'description' => 'Full access to all admin features',
                    'is_active' => true,
                    'is_system' => true,
                    'is_default' => false,
                ]
            );
        }

        $createdPermissionIds = array_values(array_unique(array_filter($createdPermissionIds)));
        if (! empty($createdPermissionIds)) {
            $infraRole->permissions()->syncWithoutDetaching($createdPermissionIds);
        }
    }

    private function makeNameFromSlug(string $slug): string
    {
        // e.g. "pos.orders.view" => "Pos Orders View"
        $parts = preg_split('/[.\-_]+/', $slug) ?: [$slug];
        $parts = array_map(static fn ($p) => ucfirst((string) $p), $parts);
        return implode(' ', $parts);
    }
}

