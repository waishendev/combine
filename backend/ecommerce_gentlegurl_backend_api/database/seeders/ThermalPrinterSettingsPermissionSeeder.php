<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ThermalPrinterSettingsPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Thermal Printer Settings'],
            ['sort_order' => 99]
        );

        foreach (['view', 'update'] as $action) {
            $permission = Permission::firstOrCreate(
                ['slug' => "ecommerce.thermal-printer-settings.{$action}"],
                [
                    'name' => 'Thermal Printer Settings '.ucfirst($action),
                    'description' => ucfirst($action).' the default POS thermal printer configuration',
                    'group_id' => $group->id,
                ]
            );

            $superAdmin = Role::where('name', 'infra_core_x1')->first();
            $superAdmin?->permissions()->syncWithoutDetaching([$permission->id]);
        }
    }
}
