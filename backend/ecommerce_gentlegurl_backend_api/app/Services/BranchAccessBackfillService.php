<?php

namespace App\Services;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Support\Facades\DB;

class BranchAccessBackfillService
{
    /**
     * One-time rollout helper for the normal application superAdmin role.
     * Active Branch IDs are snapshotted when the command runs; this grants no future bypass.
     *
     * @return array{role:string, active_branches:int, eligible_users:int, existing_assignments:int, assignments_added:int, dry_run:bool}
     */
    public function backfillRoleToAllActiveBranches(string $roleName, bool $dryRun = false): array
    {
        if ($roleName === StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE) {
            throw new \InvalidArgumentException('The Platform Super Admin role must use its permanent bypass, not pivot backfill rows.');
        }

        $branchIds = StoreLocation::query()->where('is_active', true)->pluck('id')->map(fn ($id) => (int) $id);
        $userIds = DB::table('users')
            ->whereExists(function ($query) use ($roleName) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', $roleName);
            })
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE);
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id);

        $existingAssignments = $userIds->isEmpty() || $branchIds->isEmpty()
            ? 0
            : DB::table('store_location_user')->whereIn('user_id', $userIds)->whereIn('store_location_id', $branchIds)->count();
        $missingAssignments = ($userIds->count() * $branchIds->count()) - $existingAssignments;
        $added = 0;

        if (! $dryRun && $missingAssignments > 0) {
            $now = now();
            foreach ($userIds->chunk(250) as $userChunk) {
                $rows = [];
                foreach ($userChunk as $userId) {
                    foreach ($branchIds as $branchId) {
                        $rows[] = ['user_id' => $userId, 'store_location_id' => $branchId, 'created_at' => $now, 'updated_at' => $now];
                    }
                }
                $added += DB::table('store_location_user')->insertOrIgnore($rows);
            }
        }

        return [
            'role' => $roleName,
            'active_branches' => $branchIds->count(),
            'eligible_users' => $userIds->count(),
            'existing_assignments' => (int) $existingAssignments,
            'assignments_added' => $dryRun ? 0 : (int) $added,
            'dry_run' => $dryRun,
        ];
    }

    /**
     * @return array{selected_branch: array{id:int,name:string,code:string}, eligible_users:int, newly_assigned:int, already_assigned:int, platform_super_admin_skipped:int, dry_run:bool}
     */
    public function backfill(StoreLocation $storeLocation, bool $dryRun = false): array
    {
        $platformUserQuery = DB::table('users')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE);
            });

        $eligibleUserQuery = DB::table('users')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE);
            })
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('store_location_user')
                    ->whereColumn('store_location_user.user_id', 'users.id');
            });

        $alreadyAssigned = DB::table('users')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE);
            })
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('store_location_user')
                    ->whereColumn('store_location_user.user_id', 'users.id');
            })
            ->count();

        $eligibleUsers = (clone $eligibleUserQuery)->count();
        $newlyAssigned = 0;

        if (! $dryRun) {
            $now = now();

            (clone $eligibleUserQuery)
                ->orderBy('users.id')
                ->select('users.id')
                ->chunkById(500, function ($users) use ($storeLocation, $now, &$newlyAssigned) {
                    foreach ($users as $user) {
                        $inserted = DB::table('store_location_user')->insertOrIgnore([
                            'user_id' => $user->id,
                            'store_location_id' => $storeLocation->id,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);

                        $newlyAssigned += (int) $inserted;
                    }
                }, 'users.id', 'id');
        }

        return [
            'selected_branch' => [
                'id' => (int) $storeLocation->id,
                'name' => (string) $storeLocation->name,
                'code' => (string) $storeLocation->code,
            ],
            'eligible_users' => (int) $eligibleUsers,
            'newly_assigned' => $dryRun ? 0 : (int) $newlyAssigned,
            'already_assigned' => (int) $alreadyAssigned,
            'platform_super_admin_skipped' => (int) $platformUserQuery->count(),
            'dry_run' => $dryRun,
        ];
    }
}
