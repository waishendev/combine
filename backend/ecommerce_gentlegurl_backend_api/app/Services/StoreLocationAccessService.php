<?php

namespace App\Services;

use App\Models\Ecommerce\StoreLocation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class StoreLocationAccessService
{
    public const PLATFORM_SUPER_ADMIN_ROLE = 'infra_core_x1';

    public function accessibleStoreLocations(User $user, bool $includeInactive = true): Builder
    {
        $query = StoreLocation::query()
            ->whereRaw('LOWER(name) <> ?', ['all branches'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id');

        if (! $includeInactive) {
            $query->where('is_active', true);
        }

        if ($this->hasPlatformBypass($user)) {
            return $query;
        }

        return $query->whereHas('users', fn (Builder $users) => $users->whereKey($user->getKey()));
    }

    public function canAccessStoreLocation(User $user, int|StoreLocation $location, bool $includeInactive = true): bool
    {
        $locationId = $location instanceof StoreLocation ? $location->getKey() : $location;

        return $this->accessibleStoreLocations($user, $includeInactive)
            ->whereKey($locationId)
            ->exists();
    }

    public function authorizeStoreLocation(User $user, int|StoreLocation $location, bool $includeInactive = true): StoreLocation
    {
        $locationId = $location instanceof StoreLocation ? $location->getKey() : $location;

        // Platform bypass: same eligibility rules (exclude "All Branches", optional active-only)
        // without building the full ordered accessible list / whereHas(users).
        if ($this->hasPlatformBypass($user)) {
            $query = StoreLocation::query()
                ->whereKey($locationId)
                ->whereRaw('LOWER(name) <> ?', ['all branches']);

            if (! $includeInactive) {
                $query->where('is_active', true);
            }

            $storeLocation = $query->first();
            if (! $storeLocation) {
                abort(403, __('You are not allowed to access the selected branch.'));
            }

            return $storeLocation;
        }

        $storeLocation = $this->accessibleStoreLocations($user, $includeInactive)
            ->whereKey($locationId)
            ->first();

        if (! $storeLocation) {
            abort(403, __('You are not allowed to access the selected branch.'));
        }

        return $storeLocation;
    }

    public function assertCanAssign(User $actor, array $storeLocationIds, bool $includeInactive = true): array
    {
        $ids = collect($storeLocationIds)
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        $allowedIds = $this->accessibleStoreLocations($actor, $includeInactive)
            ->whereIn('id', $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (count($allowedIds) !== count($ids)) {
            abort(403, __('You are not allowed to assign one or more selected branches.'));
        }

        return $ids;
    }

    public function hasPlatformBypass(User $user): bool
    {
        $cacheKey = 'store_location_platform_bypass_'.$user->getKey();
        if (request()->attributes->has($cacheKey)) {
            return (bool) request()->attributes->get($cacheKey);
        }

        $bypass = $user->roles()
            ->where('name', self::PLATFORM_SUPER_ADMIN_ROLE)
            ->exists();
        request()->attributes->set($cacheKey, $bypass);

        return $bypass;
    }
}
