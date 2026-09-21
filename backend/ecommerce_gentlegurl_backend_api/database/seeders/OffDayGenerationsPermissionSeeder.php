<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class OffDayGenerationsPermissionSeeder extends Seeder
{
    public const PERMISSION_SLUG = 'booking.off_day_generations.view';

    public const ROLE_NAMES = [
        'infra_core_x1',
        'superAdmin',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Booking'],
            ['sort_order' => ((int) PermissionGroup::query()->max('sort_order')) + 1]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => self::PERMISSION_SLUG],
            [
                'name' => 'Booking Off Day Generations View',
                'description' => 'View off-day generation batches.',
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

        $this->command?->info('booking.off_day_generations.view permission synced for infra_core_x1 and superAdmin roles.');
    }
}
