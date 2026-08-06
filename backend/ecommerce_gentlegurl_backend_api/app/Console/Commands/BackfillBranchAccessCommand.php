<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Services\BranchAccessBackfillService;
use Database\Seeders\BranchAccessPermissionSeeder;
use Illuminate\Console\Command;

class BackfillBranchAccessCommand extends Command
{
    protected $signature = 'branch-access:backfill
        {--store-code= : Existing StoreLocation code to use as the default Branch}
        {--force : Allow execution in production}
        {--dry-run : Show intended changes without writing}';

    protected $description = 'Backfill existing non-platform admins to an explicit default Branch without touching business records.';

    public function handle(BranchAccessBackfillService $backfill): int
    {
        if ($this->laravel->environment('production') && ! $this->option('force') && ! $this->option('dry-run')) {
            $this->error('Refusing to run in production without --force. Re-run with --force after reviewing --dry-run output.');

            return self::FAILURE;
        }

        $storeCode = trim((string) $this->option('store-code'));

        if ($storeCode === '') {
            $this->error('The --store-code option is required. Example: php artisan branch-access:backfill --store-code=PNG --dry-run');

            return self::FAILURE;
        }

        $storeLocation = StoreLocation::query()
            ->where('code', $storeCode)
            ->first();

        if (! $storeLocation || ! $storeLocation->is_active) {
            $this->error("No active StoreLocation exists with code [{$storeCode}]. This command will not create a Branch or fallback to another Branch.");

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN: no permissions, pivot assignments, StoreLocation data, or business records will be written.');
            $this->reportPermissionPreview();
        } else {
            $this->callSilent('db:seed', ['--class' => BranchAccessPermissionSeeder::class, '--force' => true]);
        }

        $summary = $backfill->backfill($storeLocation, $dryRun);

        $this->info('Branch access backfill summary');
        $this->line("Selected Branch: {$summary['selected_branch']['name']} ({$summary['selected_branch']['code']}) #{$summary['selected_branch']['id']}");
        $this->line("Eligible users without Branch assignments: {$summary['eligible_users']}");
        $this->line('Users newly assigned: '.($dryRun ? $summary['eligible_users'].' (would assign)' : $summary['newly_assigned']));
        $this->line("Users skipped because already assigned: {$summary['already_assigned']}");
        $this->line("Platform Super Admin users skipped: {$summary['platform_super_admin_skipped']}");

        return self::SUCCESS;
    }

    private function reportPermissionPreview(): void
    {
        $requiredPermissions = ['branch_access.view', 'branch_access.assign'];
        $existingPermissions = Permission::query()
            ->whereIn('slug', $requiredPermissions)
            ->pluck('slug')
            ->all();
        $missingPermissions = array_values(array_diff($requiredPermissions, $existingPermissions));

        $superAdminRoles = Role::query()
            ->whereIn('name', array_unique([config('auth.super_admin_role', 'infra_core_x1'), 'infra_core_x1']))
            ->with('permissions')
            ->get();

        $rolesNeedingAttach = $superAdminRoles
            ->filter(fn (Role $role) => collect($requiredPermissions)->diff($role->permissions->pluck('slug'))->isNotEmpty())
            ->pluck('name')
            ->values()
            ->all();

        $this->line('Permissions that would be created: '.($missingPermissions === [] ? 'none' : implode(', ', $missingPermissions)));
        $this->line('Platform Super Admin roles that would receive permissions: '.($rolesNeedingAttach === [] ? 'none' : implode(', ', $rolesNeedingAttach)));
    }
}
