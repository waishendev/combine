<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Leave Calendar manage API permission (Edit / Cancel / sync Off Day to another Branch).
 *
 * Production:
 *   php artisan db:seed --class=LeaveCalendarManagePermissionSeeder
 *
 * Assigned to: Admin, infra_core_x1, superAdmin
 * Separate from booking.off_day_generations.view (Off Days / By Weekday / By Year).
 */
class LeaveCalendarManagePermissionSeeder extends Seeder
{
    public const PERMISSION_SLUG = 'booking.leave.calendar.manage';

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Booking'],
            ['sort_order' => 100]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => self::PERMISSION_SLUG],
            [
                'name' => 'Leave Calendar Manage',
                'description' => 'Edit / Cancel leave on Leave Calendar Details, and sync an Off Day onto another accessible Branch.',
                'group_id' => $group->id,
            ]
        );

        foreach (['Admin', 'infra_core_x1', 'superAdmin'] as $roleName) {
            $roles = Role::where('name', $roleName)->get();
            if ($roles->isEmpty()) {
                $roles = collect([
                    Role::create([
                        'name' => $roleName,
                        'description' => match ($roleName) {
                            'infra_core_x1' => 'Full access to all admin features',
                            'superAdmin' => 'Super admin',
                            default => 'Branch admin',
                        },
                        'is_active' => true,
                        'is_system' => $roleName !== 'Admin',
                        'is_default' => false,
                    ]),
                ]);
            }

            foreach ($roles as $role) {
                $role->permissions()->syncWithoutDetaching([$permission->id]);
                $this->command?->info("{$roleName} #{$role->id}: ".self::PERMISSION_SLUG.' granted.');
            }
        }
    }
}
