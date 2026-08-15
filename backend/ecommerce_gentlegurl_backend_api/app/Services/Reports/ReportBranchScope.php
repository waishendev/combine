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
        /** @var User|null $user */
        $user = $request->user();
        abort_unless($user, 401);

        $requested = $request->query('branch_store_location_id');
        if ($requested !== null && $requested !== '') {
            abort_unless(filter_var($requested, FILTER_VALIDATE_INT) !== false && (int) $requested > 0, 422, 'Invalid Branch.');
            $id = (int) $requested;
            $access->authorizeStoreLocation($user, $id);

            return new self([$id], $id, false);
        }

        $ids = $access->accessibleStoreLocations($user)
            ->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        // Historical NULL rows are auditable only in All Branches; they are never
        // silently attributed to a selected Branch.
        return new self($ids, null, true);
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
