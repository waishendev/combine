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

        return new self(
            $access->accessibleStoreLocations($user)->pluck('id')->map(fn ($id) => (int) $id)->all(),
            null,
            true,
        );
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
