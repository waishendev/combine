<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Services\StoreLocationAccessService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class CleanupLegacyGlobalRolesCommand extends Command
{
    public const CONFIRMATION = 'CLEANUP_LEGACY_GLOBAL_ROLES';

    protected $signature = 'role-branch:cleanup-legacy-global
        {--dry-run : Audit and report without changing data}
        {--force : Remove only legacy Roles classified safe in the locked audit}
        {--confirm= : Required confirmation token for --force}';

    protected $description = 'Safely remove obsolete NULL operational Roles after Branch Role replication';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        if ($dryRun === $force) {
            $this->error('Provide exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        if ($force && $this->option('confirm') !== self::CONFIRMATION) {
            $this->error('Force requires --confirm='.self::CONFIRMATION.'.');
            return self::FAILURE;
        }

        $audit = $this->audit();
        $this->report($audit);
        if ($dryRun) {
            $this->info('DRY RUN ONLY — NO DATA CHANGED');
            return self::SUCCESS;
        }

        try {
            $result = DB::transaction(function (): array {
                DB::table('roles')->lockForUpdate()->pluck('id');
                DB::table('store_locations')->lockForUpdate()->pluck('id');
                DB::table('role_user')->lockForUpdate()->pluck('role_id');
                DB::table('role_user_store_location')->lockForUpdate()->pluck('role_id');
                DB::table('permission_role')->lockForUpdate()->pluck('role_id');
                DB::table('store_location_user')->lockForUpdate()->pluck('user_id');

                $locked = $this->audit();
                $removedAssignments = 0;
                $deletedRoles = 0;
                foreach ($locked['safe'] as $candidate) {
                    /** @var Role $role */
                    $role = $candidate['role'];
                    if ($this->isPlatformGlobal($role) || $role->store_location_id !== null) {
                        throw new RuntimeException("Safety classification changed for Role #{$role->id}.");
                    }
                    $removedAssignments += DB::table('role_user')->where('role_id', $role->id)->delete();
                    $deletedRoles += Role::query()->whereKey($role->id)->whereNull('store_location_id')->delete();
                }

                return compact('removedAssignments', 'deletedRoles');
            }, 3);
        } catch (\Throwable $e) {
            $this->error('Cleanup rolled back: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->table(['Force result', 'Count'], [
            ['Obsolete global role_user assignments removed', $result['removedAssignments']],
            ['Legacy NULL Roles deleted', $result['deletedRoles']],
            ['Branch assignments changed', 0],
            ['Branch access rows changed', 0],
            ['Permission definitions changed', 0],
        ]);
        $this->info('Legacy global operational Role cleanup completed.');
        return self::SUCCESS;
    }

    private function audit(): array
    {
        $legacy = Role::query()->whereNull('store_location_id')
            ->with(['permissions:id', 'users:id'])->orderBy('id')->get();
        $platform = $legacy->filter(fn (Role $role) => $this->isPlatformGlobal($role))->values();
        $activeBranches = StoreLocation::query()->where('is_active', true)
            ->whereRaw('LOWER(name) <> ?', ['all branches'])->orderBy('id')->get();
        $knownOperational = $this->operationalNames();
        $safe = collect();
        $unresolved = collect();
        $ambiguous = collect();

        foreach ($legacy->reject(fn (Role $role) => $this->isPlatformGlobal($role)) as $role) {
            $allCopies = Role::query()->whereNotNull('store_location_id')
                ->whereRaw('LOWER(name) = LOWER(?)', [$role->name])
                ->with(['permissions:id', 'storeLocation:id,name,code,is_active'])->get()->keyBy('store_location_id');
            if (! $knownOperational->contains(strtolower(trim($role->name))) && $allCopies->isEmpty()) {
                $ambiguous->push(['role' => $role, 'reasons' => ['no Branch copy or configured built-in classification proves Branch ownership']]);
                continue;
            }

            $reasons = collect();
            $requiredBranchIds = $activeBranches->pluck('id')->map(fn ($id) => (int) $id);
            $legacyUserIds = $role->users->pluck('id')->map(fn ($id) => (int) $id);
            $assignedBranchIds = DB::table('store_location_user')->whereIn('user_id', $legacyUserIds)
                ->pluck('store_location_id')->map(fn ($id) => (int) $id)->unique();
            $requiredBranchIds = $requiredBranchIds->merge($assignedBranchIds)->unique()->values();
            $missingBranchIds = $requiredBranchIds->reject(fn (int $id) => $allCopies->has($id))->values();
            if ($allCopies->isEmpty()) {
                $reasons->push('no Branch-owned replacement exists');
            }
            if ($missingBranchIds->isNotEmpty()) {
                $reasons->push('missing required Branch copies: '.$this->branchLabels($missingBranchIds));
            }

            $legacyPermissions = $role->permissions->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
            foreach ($allCopies->only($requiredBranchIds->all()) as $copy) {
                $copyPermissions = $copy->permissions->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                if ($copyPermissions !== $legacyPermissions) {
                    $reasons->push("permission conflict in Branch {$this->copyBranchLabel($copy)}");
                }
                if ((bool) $copy->is_system !== (bool) $role->is_system) {
                    $reasons->push("protection flag conflict in Branch {$this->copyBranchLabel($copy)}");
                }
            }

            $resolvedAssignments = 0;
            $verifiedBranchAssignments = 0;
            $unresolvedUsers = collect();
            foreach ($legacyUserIds as $userId) {
                $userBranchIds = DB::table('store_location_user')->where('user_id', $userId)
                    ->pluck('store_location_id')->map(fn ($id) => (int) $id)->unique();
                if ($userBranchIds->isEmpty()) {
                    $unresolvedUsers->push($userId);
                    continue;
                }
                $complete = $userBranchIds->every(function (int $branchId) use ($allCopies, $userId): bool {
                    $copy = $allCopies->get($branchId);
                    return $copy && DB::table('role_user_store_location')->where([
                        'user_id' => $userId, 'store_location_id' => $branchId, 'role_id' => $copy->id,
                    ])->exists();
                });
                if ($complete) {
                    $resolvedAssignments++;
                    $verifiedBranchAssignments += $userBranchIds->count();
                } else {
                    $unresolvedUsers->push($userId);
                }
            }
            if ($unresolvedUsers->isNotEmpty()) {
                $reasons->push('unresolved global role_user assignments for User IDs: '.$unresolvedUsers->join(', '));
            }

            $legacyBranchReferences = DB::table('role_user_store_location')->where('role_id', $role->id)->count();
            if ($legacyBranchReferences > 0) {
                $reasons->push("{$legacyBranchReferences} Branch assignment(s) still reference the legacy Role ID");
            }
            if (Schema::hasTable('model_has_roles') && Schema::hasColumn('model_has_roles', 'role_id')) {
                $modelReferences = DB::table('model_has_roles')->where('role_id', $role->id)->count();
                if ($modelReferences > 0) $reasons->push("{$modelReferences} model_has_roles reference(s) remain");
            }

            $candidate = [
                'role' => $role,
                'copies' => $allCopies,
                'missing_branch_ids' => $missingBranchIds,
                'legacy_assignments' => $legacyUserIds->count(),
                'resolved_assignments' => $resolvedAssignments,
                'verified_branch_assignments' => $verifiedBranchAssignments,
                'unresolved_assignments' => $unresolvedUsers->count(),
                'reasons' => $reasons->unique()->values(),
            ];
            ($reasons->isEmpty() ? $safe : $unresolved)->push($candidate);
        }

        return compact('platform', 'safe', 'unresolved', 'ambiguous', 'activeBranches');
    }

    private function report(array $audit): void
    {
        $this->line('Platform-global preserved:');
        foreach ($audit['platform'] as $role) $this->line("  - {$role->name} [id={$role->id}]");
        $this->line('Legacy global operational candidates:');
        foreach ($audit['safe']->concat($audit['unresolved']) as $candidate) $this->reportCandidate($candidate);
        $this->line('Ambiguous NULL Roles preserved:');
        foreach ($audit['ambiguous'] as $candidate) {
            $this->line("  - {$candidate['role']->name} [id={$candidate['role']->id}] — {$candidate['reasons'][0]}");
        }
        $this->line('Summary:');
        $this->line('  platform_global_preserved='.$audit['platform']->count());
        $this->line('  legacy_candidates='.($audit['safe']->count() + $audit['unresolved']->count()));
        $this->line('  safe_to_clean='.$audit['safe']->count());
        $this->line('  unresolved='.($audit['unresolved']->count() + $audit['ambiguous']->count()));
        $this->line('  assignments_to_remove='.$audit['safe']->sum('legacy_assignments'));
        $this->line('  roles_to_delete='.$audit['safe']->count());
    }

    private function reportCandidate(array $candidate): void
    {
        $role = $candidate['role'];
        $this->line("  - {$role->name} [id={$role->id}, is_system=".($role->is_system ? 'true' : 'false').', store_location_id=NULL]');
        $this->line('    Branch copies:');
        foreach ($candidate['copies'] as $copy) $this->line("      {$this->copyBranchLabel($copy)} -> id={$copy->id}");
        $this->line('    Branch copies missing: '.($candidate['missing_branch_ids']->isEmpty() ? 'none' : $this->branchLabels($candidate['missing_branch_ids'])));
        $this->line("    legacy global assignments: {$candidate['legacy_assignments']}");
        $this->line("    migrated Branch assignments verified: {$candidate['verified_branch_assignments']}");
        $this->line("    unresolved assignments: {$candidate['unresolved_assignments']}");
        $this->line('    legacy Permission mappings: '.$role->permissions->count().' (required copies compared exactly)');
        if ($candidate['reasons']->isEmpty()) {
            $this->line('    status: SAFE TO CLEAN');
        } else {
            $this->line('    status: UNRESOLVED');
            foreach ($candidate['reasons'] as $reason) $this->line("      reason: {$reason}");
        }
    }

    private function isPlatformGlobal(Role $role): bool
    {
        return $this->platformNames()->contains(strtolower(trim($role->name)));
    }

    private function platformNames(): Collection
    {
        return collect(config('multi_branch.platform_global_role_names', [StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE]))
            ->map(fn ($name) => strtolower(trim((string) $name)))->filter()->unique();
    }

    private function operationalNames(): Collection
    {
        return collect(config('multi_branch.legacy_operational_role_names', []))
            ->map(fn ($name) => strtolower(trim((string) $name)))->filter()->unique();
    }

    private function branchLabels(Collection $ids): string
    {
        $labels = StoreLocation::query()->whereIn('id', $ids)->get()->keyBy('id');
        return $ids->map(fn ($id) => $labels->has($id)
            ? $labels[$id]->code.' ('.$labels[$id]->name.')'
            : "Branch #{$id}")->join(', ');
    }

    private function copyBranchLabel(Role $copy): string
    {
        return $copy->storeLocation?->code ?: ($copy->storeLocation?->name ?: "Branch #{$copy->store_location_id}");
    }
}
