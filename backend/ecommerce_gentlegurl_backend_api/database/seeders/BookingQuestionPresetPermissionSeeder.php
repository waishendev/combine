<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class BookingQuestionPresetPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'booking.question_presets.view' => 'Booking Question Presets View',
        'booking.question_presets.create' => 'Booking Question Presets Create',
        'booking.question_presets.update' => 'Booking Question Presets Update',
        'booking.question_presets.delete' => 'Booking Question Presets Delete',
    ];

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

        $permissionIds = [];
        foreach (self::PERMISSIONS as $slug => $name) {
            $permission = Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => null,
                    'group_id' => $group->id,
                ]
            );
            $permissionIds[] = $permission->id;
        }

        Role::query()
            ->whereIn('name', self::ROLE_NAMES)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissionIds));

        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->command?->info('booking.question_presets.* permissions synced for infra_core_x1 and superAdmin roles.');
    }
}
