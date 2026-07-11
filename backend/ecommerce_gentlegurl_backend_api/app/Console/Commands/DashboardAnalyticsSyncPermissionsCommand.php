<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\DashboardAnalyticsPermissionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class DashboardAnalyticsSyncPermissionsCommand extends Command
{
    protected $signature = 'analytics:sync-permissions {--dry-run : Show changes without writing data}';

    protected $description = 'Safely sync dashboard analytics permissions for existing environments.';

    public function handle(): int
    {
        $slugs = array_keys(DashboardAnalyticsPermissionSeeder::PERMISSIONS);
        $existing = Permission::whereIn('slug', $slugs)->pluck('slug')->all();
        $missing = array_values(array_diff($slugs, $existing));
        $roles = Role::whereIn('name', DashboardAnalyticsPermissionSeeder::ADMIN_ROLE_NAMES)->with('permissions')->get();

        if ($this->option('dry-run')) {
            $this->info('Dashboard analytics permission sync dry run:');
            $this->line('- existing_permissions: '.(empty($existing) ? 'none' : implode(', ', $existing)));
            $this->line('- permissions_to_create: '.(empty($missing) ? 'none' : implode(', ', $missing)));
            foreach ($roles as $role) {
                $roleMissing = array_values(array_diff($slugs, $role->permissions->pluck('slug')->all()));
                $this->line(sprintf('- role %s receives: %s', $role->name, empty($roleMissing) ? 'none' : implode(', ', $roleMissing)));
            }
            $this->line('- database_changes: none');

            return self::SUCCESS;
        }

        Artisan::call('db:seed', ['--class' => DashboardAnalyticsPermissionSeeder::class, '--force' => true]);
        $this->output->write(Artisan::output());

        return self::SUCCESS;
    }
}
