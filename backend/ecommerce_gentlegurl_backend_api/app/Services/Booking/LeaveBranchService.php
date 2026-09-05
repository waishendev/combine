<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingLeaveRequest;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class LeaveBranchService
{
    public function __construct(private readonly StoreLocationAccessService $access) {}

    /** @return array<int> */
    public function eligibleBranchIds(User $user, int $staffId): array
    {
        return $this->access->accessibleStoreLocations($user, false)
            ->whereHas('staffs', fn (Builder $query) => $query->whereKey($staffId))
            ->pluck('store_locations.id')->map(fn ($id) => (int) $id)->all();
    }

    public function resolveForCreation(User $user, int $staffId, mixed $requestedBranchId): int
    {
        $eligible = $this->eligibleBranchIds($user, $staffId);
        if ($requestedBranchId !== null && $requestedBranchId !== '') {
            $id = (int) $requestedBranchId;
            if (! in_array($id, $eligible, true)) {
                throw ValidationException::withMessages(['store_location_id' => 'The selected Branch is not accessible or the Staff is not assigned to it.']);
            }
            return $id;
        }
        if (count($eligible) === 1) return $eligible[0];
        throw ValidationException::withMessages(['store_location_id' => count($eligible) === 0
            ? 'The selected Staff has no eligible accessible Branch.'
            : 'Branch is required because the selected Staff works at more than one accessible Branch.']);
    }

    public function scopeVisible(Builder $query, User $user, mixed $branchId): Builder
    {
        $accessible = $this->access->accessibleStoreLocations($user)->pluck('store_locations.id');
        if ($branchId !== null && $branchId !== '') {
            $branch = $this->access->authorizeStoreLocation($user, (int) $branchId);
            return $query->where('store_location_id', $branch->id);
        }
        return $query->where(fn (Builder $q) => $q->whereIn('store_location_id', $accessible)->orWhereNull('store_location_id'));
    }

    public function authorizeRecord(User $user, BookingLeaveRequest $leave): void
    {
        if (! $leave->store_location_id || ! $this->access->canAccessStoreLocation($user, (int) $leave->store_location_id)) {
            abort(403, 'You are not allowed to operate this Leave record Branch.');
        }
    }
}
