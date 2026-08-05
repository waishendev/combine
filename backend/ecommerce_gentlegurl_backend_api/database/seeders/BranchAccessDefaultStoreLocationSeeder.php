<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class BranchAccessDefaultStoreLocationSeeder extends Seeder
{
    public function run(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('store_location_user')) {
            throw new RuntimeException('The store_location_user table does not exist. Run php artisan migrate --force before this seeder.');
        }

        $defaultLocationId = $this->resolveDefaultLocationId();
        $superAdminRole = config('auth.super_admin_role', 'infra_core_x1');
        $now = now();

        DB::table('users')
            ->whereNotExists(function ($query) use ($superAdminRole) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->whereIn('roles.name', array_unique([$superAdminRole, 'infra_core_x1']));
            })
            ->orderBy('users.id')
            ->select('users.id')
            ->chunkById(500, function ($users) use ($defaultLocationId, $now) {
                foreach ($users as $user) {
                    DB::table('store_location_user')->updateOrInsert(
                        ['user_id' => $user->id, 'store_location_id' => $defaultLocationId],
                        ['created_at' => $now, 'updated_at' => $now]
                    );
                }
            }, 'users.id', 'id');
    }

    private function resolveDefaultLocationId(): int
    {
        $defaultCode = config('store_locations.default_code', 'PNG');

        $defaultLocationId = DB::table('store_locations')
            ->where('code', $defaultCode)
            ->where('is_active', true)
            ->value('id');

        if ($defaultLocationId) {
            return (int) $defaultLocationId;
        }

        $activeLocations = DB::table('store_locations')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->limit(2)
            ->pluck('id');

        if ($activeLocations->count() === 1) {
            return (int) $activeLocations->first();
        }

        throw new RuntimeException("Unable to determine a safe default StoreLocation for existing admin branch-access backfill. Set DEFAULT_STORE_LOCATION_CODE to an active store_locations.code before running this seeder. Current configured code: {$defaultCode}");
    }
}
