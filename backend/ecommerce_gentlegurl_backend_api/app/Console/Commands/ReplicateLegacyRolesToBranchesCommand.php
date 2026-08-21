<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Services\StoreLocationAccessService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReplicateLegacyRolesToBranchesCommand extends Command
{
    protected $signature = 'role-branch:replicate
        {--store-codes= : Comma-separated exact active Branch codes}
        {--dry-run : Audit and report without changing data}
        {--force : Create independent Branch Roles and eligible assignments atomically}';

    protected $description = 'Replicate legacy operational Role definitions into independent Branch-owned Roles';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        $codes = collect(explode(',', (string) $this->option('store-codes')))
            ->map(fn ($code) => trim($code))->filter()->unique()->values();

        if ($codes->isEmpty() || $dryRun === $force) {
            $this->error('Provide explicit --store-codes and exactly one of --dry-run or --force.');
            $this->line('  php artisan role-branch:replicate --store-codes=PNG,XXXX --dry-run');
            $this->line('  php artisan role-branch:replicate --store-codes=PNG,XXXX --force');
            return self::FAILURE;
        }

        $branches = StoreLocation::query()->whereIn('code', $codes)->where('is_active', true)->get()->keyBy('code');
        $missing = $codes->reject(fn ($code) => $branches->has($code));
        if ($missing->isNotEmpty()) {
            $this->error('Every target must exist and be active. Missing/inactive: '.$missing->join(', '));
            return self::FAILURE;
        }
        $branches = $codes->map(fn ($code) => $branches->get($code));
        $audit = $this->audit($branches);
        $this->report($branches, $audit);

        if ($dryRun) {
            $this->newLine();
            $this->info('DRY RUN ONLY — NO DATA CHANGED');
            return self::SUCCESS;
        }
        if ($audit['conflicts']->isNotEmpty()) {
            $this->error('Replication aborted: customized/different target Roles require operator review. No rows changed.');
            return self::FAILURE;
        }

        try {
            $result = DB::transaction(function () use ($branches): array {
                DB::table('roles')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
                $targetRoleIds = DB::table('roles')->whereIn('store_location_id', $branches->pluck('id'))->lockForUpdate()->pluck('id');
                DB::table('role_user')->lockForUpdate()->pluck('role_id');
                DB::table('permission_role')->whereIn('role_id', $targetRoleIds)->lockForUpdate()->pluck('role_id');
                DB::table('store_location_user')->whereIn('store_location_id', $branches->pluck('id'))->lockForUpdate()->pluck('user_id');
                $audit = $this->audit($branches);
                if ($audit['conflicts']->isNotEmpty()) {
                    throw new RuntimeException('Conflicts appeared after replication locks were acquired.');
                }

                $createdRoles = 0; $createdAssignments = 0; $removedLegacyAssignments = 0;
                foreach ($audit['roles'] as $candidate) {
                    /** @var Role $legacy */
                    $legacy = $candidate['role'];
                    $permissionIds = $candidate['permission_ids'];
                    $targetRoles = [];
                    foreach ($branches as $branch) {
                        $target = Role::query()->where('store_location_id', $branch->id)
                            ->whereRaw('LOWER(name) = LOWER(?)', [$legacy->name])->first();
                        if (! $target) {
                            $target = Role::query()->create([
                                'store_location_id' => $branch->id,
                                'name' => $legacy->name,
                                'description' => $legacy->description,
                                'is_active' => $legacy->is_active,
                                'is_system' => false,
                                'is_default' => $legacy->is_default,
                            ]);
                            $target->permissions()->sync($permissionIds);
                            $createdRoles++;
                        }
                        $targetRoles[(int) $branch->id] = $target;
                    }

                    foreach ($candidate['users'] as $user) {
                        foreach ($user['eligible_branch_ids'] as $branchId) {
                            $target = $targetRoles[$branchId];
                            $exists = DB::table('role_user_store_location')->where([
                                'user_id' => $user['user_id'], 'store_location_id' => $branchId, 'role_id' => $target->id,
                            ])->exists();
                            DB::table('role_user_store_location')->updateOrInsert(
                                ['user_id' => $user['user_id'], 'store_location_id' => $branchId, 'role_id' => $target->id],
                                ['created_at' => now(), 'updated_at' => now()]
                            );
                            if (! $exists) $createdAssignments++;
                        }
                        if ($user['eligible_branch_ids'] !== []) {
                            $verified = collect($user['eligible_branch_ids'])->every(function (int $branchId) use ($user, $targetRoles) {
                                return DB::table('role_user_store_location')->where([
                                    'user_id' => $user['user_id'], 'store_location_id' => $branchId, 'role_id' => $targetRoles[$branchId]->id,
                                ])->exists();
                            });
                            if (! $verified) throw new RuntimeException("Assignment verification failed for User #{$user['user_id']} and Role [{$legacy->name}].");
                            $removedLegacyAssignments += DB::table('role_user')->where('role_id', $legacy->id)
                                ->where('user_id', $user['user_id'])->delete();
                        }
                    }
                }
                return compact('createdRoles', 'createdAssignments', 'removedLegacyAssignments');
            }, 3);
        } catch (\Throwable $e) {
            $this->error('Replication rolled back: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->table(['Force result', 'Count'], [
            ['Branch Roles created', $result['createdRoles']],
            ['Branch assignments created', $result['createdAssignments']],
            ['Migrated legacy role_user assignments removed', $result['removedLegacyAssignments']],
            ['Branch access rows changed', 0],
        ]);
        $this->info('Legacy operational Role replication completed.');
        return self::SUCCESS;
    }

    /** @param Collection<int, StoreLocation> $branches */
    private function audit(Collection $branches): array
    {
        $legacy = Role::query()->whereNull('store_location_id')->with(['permissions:id', 'users:id'])->orderBy('id')->get();
        $system = $legacy->filter(fn (Role $role) => $role->is_system
            || strcasecmp($role->name, StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE) === 0);
        $nonSystem = $legacy->reject(fn (Role $role) => $system->contains('id', $role->id));
        $roles = collect(); $ambiguous = collect(); $conflicts = collect();
        $branchIds = $branches->pluck('id')->map(fn ($id) => (int) $id);

        foreach ($nonSystem as $role) {
            $users = collect();
            foreach ($role->users as $user) {
                $eligible = DB::table('store_location_user')->where('user_id', $user->id)
                    ->whereIn('store_location_id', $branchIds)->pluck('store_location_id')->map(fn ($id) => (int) $id)->values()->all();
                $users->push(['user_id' => (int) $user->id, 'eligible_branch_ids' => $eligible]);
            }
            if ($role->users->isEmpty() || $users->every(fn ($user) => $user['eligible_branch_ids'] === [])) {
                $ambiguous->push($role);
                continue;
            }

            $permissionIds = $role->permissions->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
            $targets = collect();
            foreach ($branches as $branch) {
                $existing = Role::query()->where('store_location_id', $branch->id)
                    ->whereRaw('LOWER(name) = LOWER(?)', [$role->name])->with('permissions:id')->first();
                $status = 'create';
                if ($existing) {
                    $actual = $existing->permissions->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                    $status = ! $existing->is_system && $actual === $permissionIds ? 'existing/matching' : 'existing/different';
                    if ($status === 'existing/different') {
                        $conflicts->push("Role [{$role->name}] in Branch [{$branch->code}] has customized/different Permissions; it will not be overwritten.");
                    }
                }
                $eligibleUsers = $users->filter(fn ($user) => in_array((int) $branch->id, $user['eligible_branch_ids'], true));
                $targetRoleId = $existing?->id;
                $existingAssignments = $targetRoleId ? DB::table('role_user_store_location')->where('store_location_id', $branch->id)
                    ->where('role_id', $targetRoleId)->whereIn('user_id', $eligibleUsers->pluck('user_id'))->count() : 0;
                $targets->push(['branch' => $branch, 'status' => $status, 'eligible' => $eligibleUsers->count(),
                    'existing_assignments' => $existingAssignments]);
            }
            $roles->push(['role' => $role, 'permission_ids' => $permissionIds, 'users' => $users, 'targets' => $targets]);
        }

        return ['roles' => $roles, 'system' => $system, 'ambiguous' => $ambiguous, 'conflicts' => $conflicts];
    }

    private function report(Collection $branches, array $audit): void
    {
        $this->line('Target Branches:');
        foreach ($branches as $branch) $this->line("  {$branch->code} (#{$branch->id})");
        $this->table(['Classification', 'Count'], [
            ['Legacy operational Roles', $audit['roles']->count()],
            ['System/global Roles preserved', $audit['system']->count()],
            ['Ambiguous Roles preserved', $audit['ambiguous']->count()],
            ['Conflicts', $audit['conflicts']->count()],
        ]);
        foreach ($audit['roles'] as $candidate) {
            $this->newLine(); $this->line($candidate['role']->name);
            foreach ($candidate['targets'] as $target) {
                $this->line("  {$target['branch']->code}: {$target['status']}; Users eligible: {$target['eligible']}; Existing assignments: {$target['existing_assignments']}");
            }
            $this->line('  Permission relationships to copy: '.count($candidate['permission_ids']));
        }
        foreach ($audit['conflicts'] as $conflict) $this->warn($conflict);
        $assignments = $audit['roles']->sum(fn ($candidate) => $candidate['targets']->sum('eligible'));
        $existing = $audit['roles']->sum(fn ($candidate) => $candidate['targets']->sum('existing_assignments'));
        $toCreate = $assignments - $existing;
        $this->line("Assignments to create: {$toCreate}; Existing assignments: {$existing}; Conflicts: {$audit['conflicts']->count()}");
    }
}
