<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Grants Staff role access to POS Appointments workspace (without POS checkout).
 *
 * Safe to run on live: idempotent firstOrCreate + syncWithoutDetaching.
 */
class StaffPosAppointmentsPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $posGroup = PermissionGroup::firstOrCreate(
            ['name' => 'POS'],
            ['sort_order' => 999]
        );

        $permission = Permission::updateOrCreate(
            ['slug' => 'pos.appointments.manage'],
            [
                'name' => 'POS Appointments Manage',
                'description' => 'Access POS Appointments: refresh, create bookings, requests, edit settlement, service photos, and online deposit links (no POS checkout).',
                'group_id' => $posGroup->id,
            ]
        );

        $staffSlugs = [
            'pos.appointments.manage',
            'customers.create',
            'booking.appointments.update_status',
        ];

        $staffPermissionIds = Permission::query()
            ->whereIn('slug', $staffSlugs)
            ->pluck('id')
            ->all();

        $staffRole = Role::query()->whereRaw('LOWER(name) = ?', ['staff'])->first();
        if ($staffRole && ! empty($staffPermissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($staffPermissionIds);
            $this->command?->info('Granted POS appointments permissions to Staff role.');
        } else {
            $this->command?->warn('Staff role not found or permissions missing — nothing assigned.');
        }

        foreach (['admin', 'infra_core_x1'] as $roleName) {
            $role = Role::query()->whereRaw('LOWER(name) = ?', [$roleName])->first();
            if ($role) {
                $role->permissions()->syncWithoutDetaching([$permission->id]);
            }
        }
    }
}
