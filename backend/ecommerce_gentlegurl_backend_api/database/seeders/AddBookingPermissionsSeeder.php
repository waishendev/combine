<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Add Booking Permissions Seeder
 *
 * Purpose: Add booking-related permission group and permissions to LIVE database
 * without requiring a full migration refresh.
 *
 * This seeder is idempotent and safe to run on LIVE:
 * - Uses firstOrCreate (only creates if doesn't exist)
 * - syncWithoutDetaching (only adds permissions, doesn't remove existing)
 */
class AddBookingPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create Booking permission group
        $bookingGroup = PermissionGroup::firstOrCreate(
            ['name' => 'Booking'],
            ['sort_order' => 100] // Set a high sort_order to add at the end
        );

        // 2. Define booking permissions (as they appear in PermissionSeeder.php)
        $bookingPermissions = [
            'appointments.view',
            'appointments.update_status',
            'appointments.reschedule',
            'services.view',
            'services.create',
            'services.update',
            'services.delete',
            'schedules.view',
            'schedules.create',
            'schedules.update',
            'schedules.delete',
            'blocks.view',
            'blocks.create',
            'blocks.update',
            'blocks.delete',
            'reports.view',
            'logs.view',
            'settings.view',
            'settings.update',
            'seo.view',
        ];

        $createdPermissionIds = [];

        // 3. Create each permission with booking. prefix
        foreach ($bookingPermissions as $action) {
            $slug = "booking.{$action}";

            $permission = Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $this->makePermissionName('booking', $action),
                    'description' => null,
                    'group_id' => $bookingGroup->id,
                ]
            );

            // Backfill group_id if old record had null
            if ($permission->group_id === null) {
                $permission->group_id = $bookingGroup->id;
                $permission->save();
            }

            $createdPermissionIds[] = $permission->id;
        }

        // 4. Grant all booking permissions to infra_core_x1 role
        $infraRole = Role::query()->where('name', 'infra_core_x1')->first();

        if ($infraRole) {
            $createdPermissionIds = array_values(array_unique(array_filter($createdPermissionIds)));
            if (! empty($createdPermissionIds)) {
                $infraRole->permissions()->syncWithoutDetaching($createdPermissionIds);
                $this->command->info("Added booking permissions to 'infra_core_x1' role.");
            }
        } else {
            $this->command->warn("'infra_core_x1' role not found. Permissions created but not assigned.");
        }

        $this->command->info("Successfully created booking permission group and " . count($createdPermissionIds) . " permissions.");
    }

    /**
     * Generate permission name from module and action
     * e.g., 'booking' + 'appointments.view' => 'Booking Appointments View'
     */
    private function makePermissionName(string $module, string $action): string
    {
        // Replace dots and dashes with spaces, then capitalize
        $parts = preg_split('/[.\-_]+/', $action) ?: [$action];
        $parts = array_map(static fn ($p) => ucfirst((string) $p), $parts);
        
        return ucfirst($module) . ' ' . implode(' ', $parts);
    }
}
