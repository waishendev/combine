<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Cancel Leave Calendar leave that starts today or earlier.
 *
 * Production:
 *   php artisan db:seed --class=LeaveCalendarCancelPastPermissionSeeder
 *
 * Assigned to: infra_core_x1, superAdmin only.
 */
class LeaveCalendarCancelPastPermissionSeeder extends Seeder
{
    public const PERMISSION_SLUG = 'booking.leave.calendar.cancel-past';

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Booking'],
            ['sort_order' => 100]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => self::PERMISSION_SLUG],
            [
                'name' => 'Leave Calendar Cancel Past / Same Day',
                'description' => 'Cancel approved leave on Leave Calendar when the leave start date is today or earlier. Future-start leave can still be cancelled with Leave Calendar Manage.',
                'group_id' => $group->id,
            ]
        );

        foreach (['infra_core_x1', 'superAdmin'] as $roleName) {
            $roles = Role::where('name', $roleName)->get();
            if ($roles->isEmpty()) {
                $this->command?->warn("Role {$roleName} not found; permission created but not assigned.");
                continue;
            }

            foreach ($roles as $role) {
                $role->permissions()->syncWithoutDetaching([$permission->id]);
                $this->command?->info("{$roleName} #{$role->id}: ".self::PERMISSION_SLUG.' granted.');
            }
        }
    }
}
