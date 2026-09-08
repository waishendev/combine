<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

final class ExpenseBranchScope
{
    /** @param list<int> $storeLocationIds */
    public function __construct(
        public readonly array $storeLocationIds,
        public readonly ?int $selectedStoreLocationId,
        public readonly bool $includeUnassigned,
    ) {
    }

    public static function fromRequest(Request $request, StoreLocationAccessService $access): self
    {
        $cacheKey = self::class;
        $cached = $request->attributes->get($cacheKey);
        if ($cached instanceof self) {
            return $cached;
        }

        /** @var User|null $user */
        $user = $request->user();
        abort_unless($user, 401);

        $requested = $request->query('branch_store_location_id');
        if ($requested !== null && $requested !== '') {
            abort_unless(filter_var($requested, FILTER_VALIDATE_INT) !== false && (int) $requested > 0, 422, 'Invalid Branch.');
            $id = (int) $requested;
            $access->authorizeStoreLocation($user, $id);

            $scope = new self([$id], $id, false);
            $request->attributes->set($cacheKey, $scope);

            return $scope;
        }

        $scope = new self(
            $access->accessibleStoreLocations($user)->pluck('id')->map(fn ($id) => (int) $id)->all(),
            null,
            true,
        );
        $request->attributes->set($cacheKey, $scope);

        return $scope;
    }

    /**
     * Roles list: when a specific Branch is selected, still include Global / Unassigned
     * (store_location_id IS NULL) for actors with roles.view-all or admins.manage-system.
     * Platform system roles (e.g. infra_core_x1) remain gated separately by canManageSystemAdmins().
     */
    public static function forRoles(Request $request, StoreLocationAccessService $access): self
    {
        $scope = self::fromRequest($request, $access);
        /** @var User|null $user */
        $user = $request->user();
        if (! $user) {
            return $scope;
        }

        $canViewGlobal = $user->canManageSystemAdmins()
            || $user->getAllPermissions()->contains('roles.view-all');

        return $canViewGlobal ? $scope->includingUnassigned() : $scope;
    }

    public function includingUnassigned(): self
    {
        if ($this->includeUnassigned) {
            return $this;
        }

        return new self($this->storeLocationIds, $this->selectedStoreLocationId, true);
    }

    public function apply(Builder $query, string $column = 'store_location_id'): Builder
    {
        return $query->where(function (Builder $branchQuery) use ($column) {
            $branchQuery->whereIn($column, $this->storeLocationIds);
            if ($this->includeUnassigned) {
                $branchQuery->orWhereNull($column);
            }
        });
    }
}
