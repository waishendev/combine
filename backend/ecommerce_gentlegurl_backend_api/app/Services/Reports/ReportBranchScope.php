<?php

namespace App\Services\Reports;

use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;

final class ReportBranchScope
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

        $ids = $access->accessibleStoreLocations($user)
            ->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        // Historical NULL rows are auditable only in All Branches; they are never
        // silently attributed to a selected Branch.
        $scope = new self($ids, null, true);
        $request->attributes->set($cacheKey, $scope);

        return $scope;
    }

    /** Safe default for operational reports: omitted scope means authenticated accessible All. */
    public static function current(): self
    {
        $request = request();
        $cacheKey = self::class;
        $cached = $request->attributes->get($cacheKey);
        if ($cached instanceof self) {
            return $cached;
        }
        // Trusted CLI/report reconciliation has no authenticated browser scope.
        // HTTP endpoints remain fail-closed through fromRequest().
        if (! $request->user() && app()->runningInConsole()) {
            $scope = new self(\App\Models\Ecommerce\StoreLocation::query()->pluck('id')->map(fn ($id) => (int) $id)->all(), null, true);
            $request->attributes->set($cacheKey, $scope);
            return $scope;
        }
        $scope = self::fromRequest($request, app(StoreLocationAccessService::class));
        $request->attributes->set($cacheKey, $scope);

        return $scope;
    }

    public static function applyCurrent($query, string $column = 'store_location_id'): mixed
    {
        return self::current()->apply($query, $column);
    }

    public function apply($query, string $column = 'store_location_id'): mixed
    {
        return $query->where(function ($builder) use ($column) {
            $builder->whereIn($column, $this->storeLocationIds);
            if ($this->includeUnassigned) {
                $builder->orWhereNull($column);
            }
        });
    }
}
