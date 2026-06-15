<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ActivityLogPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Activity Logs'],
            ['sort_order' => 99]
        );

        $permission = Permission::firstOrCreate(
            ['slug' => 'activity-logs.view'],
            [
                'name' => 'Activity-logs View',
                'description' => 'View system activity logs',
                'group_id' => $group->id,
            ]
        );

        $superAdminRole = Role::where('name', 'infra_core_x1')->first();
        if ($superAdminRole) {
            $superAdminRole->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $this->command->info("✅ activity-logs.view permission created and assigned to super admin role.");
    }
}
