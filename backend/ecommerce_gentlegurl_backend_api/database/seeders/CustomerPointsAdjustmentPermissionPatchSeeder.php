<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * LIVE-safe patch for member points adjustment logs permission.
 *
 * Run on existing environments without migrate:fresh:
 *   php artisan db:seed --class=CustomerPointsAdjustmentPermissionPatchSeeder
 *
 * - firstOrCreate only (no deletes)
 * - syncWithoutDetaching only (no detach)
 */
class CustomerPointsAdjustmentPermissionPatchSeeder extends Seeder
{
    public function run(): void
    {
        $customersGroup = PermissionGroup::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower('Customers')])
            ->first();

        if (! $customersGroup) {
            $customersGroup = PermissionGroup::firstOrCreate(
                ['name' => 'Customers'],
                ['sort_order' => null],
            );
        }

        $slug = 'customers.points_adjustment_logs.view';

        $permission = Permission::firstOrCreate(
            ['slug' => $slug],
            [
                'name' => 'Customers Points Adjustment Logs View',
                'description' => null,
                'group_id' => $customersGroup->id,
            ],
        );

        if ($permission->group_id === null && $customersGroup->id !== null) {
            $permission->group_id = $customersGroup->id;
            $permission->save();
        }

        $roleNames = ['infra_core_x1', 'admin'];

        foreach ($roleNames as $roleName) {
            $role = Role::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($roleName)])
                ->first();

            if ($role) {
                $role->permissions()->syncWithoutDetaching([$permission->id]);
            }
        }

        // Also grant to roles that already have deposit waiver logs access.
        Role::query()
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'customers.deposit_waiver_logs.view'))
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id]));
    }
}
