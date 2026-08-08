<?php

namespace App\Console\Commands;

use App\Models\Booking\BookingService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingLeaveRequest;
use Illuminate\Console\Command;

class BookingBranchBackfillCommand extends Command
{
    protected $signature = 'booking-branch:backfill {--store-code= : Existing active Branch code} {--dry-run : Report without writing} {--force : Apply missing assignments}';
    protected $description = 'Add legacy Staff and Booking Service assignments to an explicitly selected Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '') {
            $this->error('--store-code is required.');
            return self::INVALID;
        }
        if ((bool) $this->option('dry-run') === (bool) $this->option('force')) {
            $this->error('Choose exactly one of --dry-run or --force.');
            return self::INVALID;
        }

        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) {
            $this->error("Active Branch code [{$code}] was not found. No writes performed.");
            return self::FAILURE;
        }

        $staffTotal = Staff::query()->count();
        $staffAssigned = Staff::query()->whereHas('storeLocations', fn ($q) => $q->whereKey($branch->id))->count();
        $serviceTotal = BookingService::query()->count();
        $serviceAssigned = BookingService::query()->whereHas('storeLocations', fn ($q) => $q->whereKey($branch->id))->count();
        $assignedStaffIds = Staff::query()->whereHas('storeLocations', fn ($q) => $q->whereKey($branch->id))->pluck('id');
        $scheduleMissing = BookingStaffSchedule::query()->whereNull('store_location_id')->whereIn('staff_id', $assignedStaffIds)->count();
        $scheduleUnresolved = BookingStaffSchedule::query()->whereNull('store_location_id')->whereNotIn('staff_id', $assignedStaffIds)->count();
        $leaveTimeoffIds = BookingLeaveRequest::query()->whereNotNull('approved_timeoff_id')->pluck('approved_timeoff_id');
        $timeoffMissing = BookingStaffTimeoff::query()->whereNull('store_location_id')->whereNotIn('id', $leaveTimeoffIds)->whereIn('staff_id', $assignedStaffIds)->count();
        $timeoffUnresolved = BookingStaffTimeoff::query()->whereNull('store_location_id')->whereNotIn('id', $leaveTimeoffIds)->whereNotIn('staff_id', $assignedStaffIds)->count();
        $blockMissing = BookingBlock::query()->whereNull('store_location_id')->where(fn ($q) => $q->where('scope', 'STORE')->orWhereIn('staff_id', $assignedStaffIds))->count();
        $blockUnresolved = BookingBlock::query()->whereNull('store_location_id')->where('scope', 'STAFF')->whereNotIn('staff_id', $assignedStaffIds)->count();

        $this->table(['Record type', 'Total', 'Already assigned', 'Missing'], [
            ['Staff', $staffTotal, $staffAssigned, $staffTotal - $staffAssigned],
            ['Booking Services', $serviceTotal, $serviceAssigned, $serviceTotal - $serviceAssigned],
            ['Schedules', BookingStaffSchedule::query()->count(), BookingStaffSchedule::query()->whereNotNull('store_location_id')->count(), $scheduleMissing],
            ['Operational Time-Off', BookingStaffTimeoff::query()->whereNotIn('id', $leaveTimeoffIds)->count(), BookingStaffTimeoff::query()->whereNotNull('store_location_id')->count(), $timeoffMissing],
            ['Booking Blocks', BookingBlock::query()->count(), BookingBlock::query()->whereNotNull('store_location_id')->count(), $blockMissing],
            ['Invalid/unresolved', $scheduleUnresolved + $timeoffUnresolved + $blockUnresolved, 0, $scheduleUnresolved + $timeoffUnresolved + $blockUnresolved],
        ]);

        if ($this->option('dry-run')) {
            $this->info('Dry run complete. Zero writes performed.');
            return self::SUCCESS;
        }

        Staff::query()->whereDoesntHave('storeLocations', fn ($q) => $q->whereKey($branch->id))
            ->eachById(fn (Staff $staff) => $staff->storeLocations()->syncWithoutDetaching([$branch->id]));
        BookingService::query()->whereDoesntHave('storeLocations', fn ($q) => $q->whereKey($branch->id))
            ->eachById(fn (BookingService $service) => $service->storeLocations()->syncWithoutDetaching([$branch->id]));
        BookingStaffSchedule::query()->whereNull('store_location_id')->whereIn('staff_id', $assignedStaffIds)->update(['store_location_id' => $branch->id]);
        BookingStaffTimeoff::query()->whereNull('store_location_id')->whereNotIn('id', $leaveTimeoffIds)->whereIn('staff_id', $assignedStaffIds)->update(['store_location_id' => $branch->id]);
        BookingBlock::query()->whereNull('store_location_id')->where(fn ($q) => $q->where('scope', 'STORE')->orWhereIn('staff_id', $assignedStaffIds))->update(['store_location_id' => $branch->id]);

        $this->info(sprintf('Applied %d Staff, %d Service, %d Schedule, %d operational Time-Off, and %d Block attributions; non-null and unresolved records were preserved.', $staffTotal - $staffAssigned, $serviceTotal - $serviceAssigned, $scheduleMissing, $timeoffMissing, $blockMissing));
        return self::SUCCESS;
    }
}
