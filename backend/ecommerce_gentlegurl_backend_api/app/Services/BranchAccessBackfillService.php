<?php

namespace App\Services;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Support\Facades\DB;

class BranchAccessBackfillService
{
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
