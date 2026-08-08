<?php

namespace Database\Seeders;

use App\Models\Booking\BookingService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingLeaveRequest;
use Illuminate\Database\Seeder;
use RuntimeException;

class BookingBranchAssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $branch = StoreLocation::query()->where('code', config('multi_branch.fresh_install_store_code'))
            ->where('is_active', true)->first();
        if (! $branch) {
            throw new RuntimeException('Configured fresh-install Branch does not exist or is inactive.');
        }
        Staff::query()->eachById(fn (Staff $staff) => $staff->storeLocations()->syncWithoutDetaching([$branch->id]));
        BookingService::query()->eachById(fn (BookingService $service) => $service->storeLocations()->syncWithoutDetaching([$branch->id]));
        $staffIds = Staff::query()->whereHas('storeLocations', fn ($query) => $query->whereKey($branch->id))->pluck('id');
        BookingStaffSchedule::query()->whereNull('store_location_id')->whereIn('staff_id', $staffIds)->update(['store_location_id' => $branch->id]);
        $leaveTimeoffIds = BookingLeaveRequest::query()->whereNotNull('approved_timeoff_id')->pluck('approved_timeoff_id');
        BookingStaffTimeoff::query()->whereNull('store_location_id')->whereNotIn('id', $leaveTimeoffIds)->whereIn('staff_id', $staffIds)->update(['store_location_id' => $branch->id]);
        BookingBlock::query()->whereNull('store_location_id')->where(fn ($query) => $query->where('scope', 'STORE')->orWhereIn('staff_id', $staffIds))->update(['store_location_id' => $branch->id]);
    }
}
