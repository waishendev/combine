<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingStaffSchedule;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Validation\ValidationException;

class BookingBranchScheduleService
{
    public function __construct(private readonly StoreLocationAccessService $access) {}

    public function authorizeOperationalBranch(User $actor, int $storeLocationId): StoreLocation
    {
        $branch = $this->access->authorizeStoreLocation($actor, $storeLocationId, false);
        if (! $branch->is_booking_available) {
            throw ValidationException::withMessages(['store_location_id' => 'The selected Branch is not available for booking.']);
        }
        return $branch;
    }

    public function authorizeHistoricalBranch(User $actor, int $storeLocationId): StoreLocation
    {
        return $this->access->authorizeStoreLocation($actor, $storeLocationId, true);
    }

    public function assertStaffAssigned(int $staffId, int $storeLocationId): Staff
    {
        $staff = Staff::query()->findOrFail($staffId);
        if (! $staff->worksAt($storeLocationId)) {
            throw ValidationException::withMessages(['store_location_id' => 'The selected Staff is not assigned to this Branch.']);
        }
        return $staff;
    }

    public function assertScheduleDoesNotOverlap(int $staffId, int $dayOfWeek, string $startTime, string $endTime, bool $willBeActive, ?int $ignoreId = null): void
    {
        if ($this->minutes($startTime) >= $this->minutes($endTime)) {
            throw ValidationException::withMessages(['end_time' => 'End time must be later than start time.']);
        }

        if (! $willBeActive) {
            return;
        }

        $overlap = BookingStaffSchedule::query()
            ->where('staff_id', $staffId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime)
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['start_time' => 'This schedule overlaps another active schedule for the Staff, including schedules at other Branches.']);
        }
    }

    private function minutes(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', substr($time, 0, 5)));
        return $hour * 60 + $minute;
    }
}
