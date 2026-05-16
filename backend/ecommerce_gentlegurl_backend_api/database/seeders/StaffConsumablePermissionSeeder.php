<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class StaffConsumablePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $posGroup = PermissionGroup::firstOrCreate(
            ['name' => 'POS'],
            ['sort_order' => 999]
        );

        $permissions = [
            'pos.staff_consumables.access' => 'POS Staff Consumables Access',
            'pos.staff_consumables.checkout' => 'POS Staff Consumables Checkout',
            'pos.staff_consumables.view_logs' => 'POS Staff Consumables View Logs',
        ];

        foreach ($permissions as $slug => $name) {
            Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => 'Staff consumables permission seeded safely without wiping data.',
                    'group_id' => $posGroup->id,
                ]
            );
        }

        $staffPermissionIds = Permission::query()
            ->whereIn('slug', [
                'pos.staff_consumables.access',
                'pos.staff_consumables.checkout',
            ])
            ->pluck('id')
            ->all();

        $staffRole = Role::query()->whereRaw('LOWER(name) = ?', ['staff'])->first();
        if ($staffRole && ! empty($staffPermissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($staffPermissionIds);
        }

        $adminPermissionIds = Permission::query()
            ->whereIn('slug', array_keys($permissions))
            ->pluck('id')
            ->all();

        foreach (['admin', 'infra_core_x1'] as $roleName) {
            $role = Role::query()->whereRaw('LOWER(name) = ?', [$roleName])->first();
            if ($role && ! empty($adminPermissionIds)) {
                $role->permissions()->syncWithoutDetaching($adminPermissionIds);
            }
        }
    }
}
