<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AppointmentActivityLogPermissionSeeder extends Seeder
{
    public const PERMISSION_SLUG = 'appointment_activity_logs.view';

    public const ROLE_NAMES = [
        'infra_core_x1',
        'superAdmin',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Appointment Activity Logs'],
            ['sort_order' => ((int) PermissionGroup::query()->max('sort_order')) + 1]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => self::PERMISSION_SLUG],
            [
                'name' => 'Appointment Activity Logs View',
                'description' => 'View simplified appointment activity logs.',
                'group_id' => $group->id,
            ]
        );

        Role::query()
            ->whereIn('name', self::ROLE_NAMES)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$permission->id]));

        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->command?->info('appointment_activity_logs.view permission synced for infra_core_x1 and superAdmin roles.');
    }
}
