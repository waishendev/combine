<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Admin leave access:
 * - YES: Leave Calendar view, Details Edit/Cancel (booking.schedules.update)
 * - YES: Leave Balances view (booking.schedules.view)
 * - NO: Leave Balances ADD/REDUCE, Off Days / By Weekday / By Year (booking.off_day_generations.view)
 *
 * Production:
 *   php artisan db:seed --class=RestrictAdminLeaveToolsSeeder
 */
class RestrictAdminLeaveToolsSeeder extends Seeder
{
    /** @var list<string> */
    public const DETACH_SLUGS = [
        'booking.schedules.create',
        'booking.off_day_generations.view',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Booking'],
            ['sort_order' => 100]
        );

        $schedulesUpdate = Permission::firstOrCreate(
            ['slug' => 'booking.schedules.update'],
            [
                'name' => 'Booking Schedules Update',
                'description' => null,
                'group_id' => $group->id,
            ]
        );
        if ($schedulesUpdate->group_id === null) {
            $schedulesUpdate->group_id = $group->id;
            $schedulesUpdate->save();
        }

        $detachIds = Permission::query()
            ->whereIn('slug', self::DETACH_SLUGS)
            ->pluck('id')
            ->all();

        $adminRoles = Role::where('name', 'Admin')->get();
        if ($adminRoles->isEmpty()) {
            $this->command?->warn('RestrictAdminLeaveToolsSeeder: no Admin roles found.');

            return;
        }

        foreach ($adminRoles as $adminRole) {
            $adminRole->permissions()->syncWithoutDetaching([$schedulesUpdate->id]);
            if ($detachIds !== []) {
                $adminRole->permissions()->detach($detachIds);
            }
            $this->command?->info(
                "Admin #{$adminRole->id}: schedules.update granted; off_day_generations.view detached (no ADD/REDUCE / Off Day tools)."
            );
        }
    }
}
