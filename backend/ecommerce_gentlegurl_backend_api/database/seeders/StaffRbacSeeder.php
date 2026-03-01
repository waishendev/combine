<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class StaffRbacSeeder extends Seeder
{
    public function run(): void
    {
        $staffRole = Role::query()
            ->whereRaw('LOWER(name) = ?', ['staff'])
            ->first();

        if (! $staffRole) {
            $staffRole = Role::create([
                'name' => 'Staff',
                'description' => 'Staff role for POS and limited CRM access',
                'is_active' => true,
                'is_system' => false,
                'is_default' => true,
            ]);
        } else {
            $staffRole->name = 'Staff';
            $staffRole->description = $staffRole->description ?: 'Staff role for POS and limited CRM access';
            $staffRole->is_active = true;
            $staffRole->is_system = false;
            $staffRole->is_default = true;
            $staffRole->save();
        }

        $permissionIds = Permission::whereIn('slug', [
            'staff.view',
            'pos.checkout',
            'pos.orders.view',
            'reports.my-pos-summary.view',
        ])->pluck('id')->all();

        if (! empty($permissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($permissionIds);
        }
    }
}
