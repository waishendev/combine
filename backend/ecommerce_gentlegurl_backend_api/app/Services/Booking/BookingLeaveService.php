<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingLeaveBalance;
use App\Models\Booking\BookingLeaveLog;
use App\Models\Booking\BookingLeaveRequest;
use App\Models\Booking\BookingStaffSchedule;
use Carbon\Carbon;

class BookingLeaveService
{
    /**
     * @return array<int, array{leave_type:string, entitled_days:float, used_days:float, remaining_days:float}>
     */
    public function getBalanceSummaryForStaff(int $staffId): array
    {
        $types = ['annual', 'mc', 'emergency', 'unpaid'];

        $entitlements = BookingLeaveBalance::query()
            ->where('staff_id', $staffId)
            ->get()
            ->keyBy('leave_type');

        $usedByType = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->where('status', 'approved')
            ->whereIn('leave_type', ['annual', 'mc', 'emergency'])
            ->selectRaw('leave_type, COALESCE(SUM(days), 0) as used_days')
            ->groupBy('leave_type')
            ->pluck('used_days', 'leave_type');

        $summary = [];
        foreach ($types as $type) {
            $entitled = (float) ($entitlements[$type]->entitled_days ?? 0);
            $used = (float) ($usedByType[$type] ?? 0);

            $summary[] = [
                'leave_type' => $type,
                'entitled_days' => $entitled,
                'used_days' => $used,
                'remaining_days' => max(0, $entitled - $used),
            ];
        }

        return $summary;
    }

    public function getRemainingAnnualDays(int $staffId): float
    {
        return $this->getRemainingDaysByType($staffId, 'annual');
    }

    public function getRemainingDaysByType(int $staffId, string $leaveType): float
    {
        $summary = collect($this->getBalanceSummaryForStaff($staffId));

        return (float) ($summary->firstWhere('leave_type', $leaveType)['remaining_days'] ?? 0);
    }

    public function calculateRequestedDays(Carbon $startDate, Carbon $endDate, string $dayType): float
    {
        if ($startDate->isSameDay($endDate) && in_array($dayType, ['half_day_am', 'half_day_pm'], true)) {
            return 0.5;
        }

        return (float) $startDate->diffInDays($endDate) + 1;
    }

    public function hasOverlappingRequest(
        int $staffId,
        Carbon $startDate,
        Carbon $endDate,
        string $dayType,
        ?int $ignoreRequestId = null
    ): bool {
        $query = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $endDate->toDateString())
            ->whereDate('end_date', '>=', $startDate->toDateString());

        if ($ignoreRequestId) {
            $query->where('id', '!=', $ignoreRequestId);
        }

        $existingRows = $query->get();

        foreach ($existingRows as $existing) {
            $existingStart = Carbon::parse((string) $existing->start_date)->startOfDay();
            $existingEnd = Carbon::parse((string) $existing->end_date)->startOfDay();
            $existingDayType = (string) ($existing->day_type ?: 'full_day');

            $intersectionStart = $startDate->copy()->startOfDay()->greaterThan($existingStart)
                ? $startDate->copy()->startOfDay()
                : $existingStart;
            $intersectionEnd = $endDate->copy()->startOfDay()->lessThan($existingEnd)
                ? $endDate->copy()->startOfDay()
                : $existingEnd;

            for ($cursor = $intersectionStart->copy(); $cursor->lte($intersectionEnd); $cursor->addDay()) {
                [$newStart, $newEnd] = $this->resolveDayPeriod($cursor, $startDate, $endDate, $dayType);
                [$oldStart, $oldEnd] = $this->resolveDayPeriod($cursor, $existingStart, $existingEnd, $existingDayType);

                if (max($newStart, $oldStart) < min($newEnd, $oldEnd)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    public function resolveTimeoffWindow(int $staffId, Carbon $startDate, Carbon $endDate, string $dayType): array
    {
        if (! $startDate->isSameDay($endDate)) {
            return [$startDate->copy()->startOfDay(), $endDate->copy()->endOfDay()];
        }

        $schedule = BookingStaffSchedule::query()
            ->where('staff_id', $staffId)
            ->where('day_of_week', $startDate->dayOfWeek)
            ->first();

        $workStart = $schedule
            ? Carbon::parse($startDate->toDateString() . ' ' . $schedule->start_time)
            : $startDate->copy()->startOfDay();

        $workEnd = $schedule
            ? Carbon::parse($startDate->toDateString() . ' ' . $schedule->end_time)
            : $startDate->copy()->endOfDay();

        if ($dayType === 'full_day') {
            return [$workStart, $workEnd];
        }

        $halfMinutes = (int) floor($workStart->diffInMinutes($workEnd) / 2);
        $midPoint = $workStart->copy()->addMinutes($halfMinutes);

        if ($dayType === 'half_day_am') {
            return [$workStart, $midPoint];
        }

        return [$midPoint, $workEnd];
    }

    public function logAction(
        int $staffId,
        ?int $leaveRequestId,
        string $actionType,
        ?array $beforeValue,
        ?array $afterValue,
        ?string $remark,
        ?int $createdBy
    ): void {
        BookingLeaveLog::query()->create([
            'staff_id' => $staffId,
            'leave_request_id' => $leaveRequestId,
            'action_type' => $actionType,
            'before_value' => $beforeValue,
            'after_value' => $afterValue,
            'remark' => $remark,
            'created_by' => $createdBy,
        ]);
    }

    /**
     * Weekdays (0=Sun … 6=Sat) with no active weekly staff schedule.
     *
     * @return array<int>
     */
    public function getOffWeekdaysForStaff(int $staffId): array
    {
        $activeDays = BookingStaffSchedule::query()
            ->where('staff_id', $staffId)
            ->where('is_active', true)
            ->pluck('day_of_week')
            ->map(fn ($day) => (int) $day)
            ->unique()
            ->values()
            ->all();

        return array_values(array_diff(range(0, 6), $activeDays));
    }

    /**
     * @return array<int, string>
     */
    public function weekdayLabels(): array
    {
        return [
            0 => 'Sunday',
            1 => 'Monday',
            2 => 'Tuesday',
            3 => 'Wednesday',
            4 => 'Thursday',
            5 => 'Friday',
            6 => 'Saturday',
        ];
    }

    public function createApprovedOffDay(
        int $staffId,
        Carbon $startDate,
        Carbon $endDate,
        ?string $reason,
        ?int $actorUserId,
        ?string $adminRemark = 'Off day set by admin'
    ): ?BookingLeaveRequest {
        if ($this->hasOverlappingRequest($staffId, $startDate, $endDate, 'full_day')) {
            return null;
        }

        $days = $this->calculateRequestedDays($startDate, $endDate, 'full_day');

        $item = BookingLeaveRequest::query()->create([
            'staff_id' => $staffId,
            'leave_type' => 'off_day',
            'day_type' => 'full_day',
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'days' => $days,
            'reason' => $reason,
            'status' => 'approved',
            'admin_remark' => $adminRemark,
            'reviewed_by_user_id' => $actorUserId,
            'reviewed_at' => now(),
        ]);

        [$startAt, $endAt] = $this->resolveTimeoffWindow($staffId, $startDate, $endDate, 'full_day');

        $timeoff = \App\Models\Booking\BookingStaffTimeoff::create([
            'staff_id' => $item->staff_id,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'reason' => sprintf('Off day #%d', $item->id),
        ]);

        $item->approved_timeoff_id = $timeoff->id;
        $item->save();

        $this->logAction(
            $staffId,
            (int) $item->id,
            'approved',
            null,
            [
                'status' => $item->status,
                'leave_type' => $item->leave_type,
                'day_type' => $item->day_type,
                'total_days' => (float) $item->days,
                'approved_timeoff_id' => $item->approved_timeoff_id,
            ],
            $adminRemark,
            $actorUserId
        );

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    public function snapshotOffDay(BookingLeaveRequest $item): array
    {
        return [
            'leave_type' => (string) $item->leave_type,
            'status' => (string) $item->status,
            'start_date' => (string) $item->start_date,
            'end_date' => (string) $item->end_date,
            'reason' => $item->reason,
            'total_days' => (float) $item->days,
            'approved_timeoff_id' => $item->approved_timeoff_id,
        ];
    }

    public function cancelApprovedOffDay(BookingLeaveRequest $item, ?int $actorUserId, ?string $remark = null): bool
    {
        if ($item->leave_type !== 'off_day' || $item->status !== 'approved') {
            return false;
        }

        $before = $this->snapshotOffDay($item);

        if ($item->approvedTimeoff) {
            $item->approvedTimeoff->delete();
        }

        $item->status = 'cancelled';
        $item->approved_timeoff_id = null;
        $item->save();

        $this->logAction(
            (int) $item->staff_id,
            (int) $item->id,
            'cancelled',
            $before,
            $this->snapshotOffDay($item->fresh()),
            $remark ?? 'Off day cancelled by admin.',
            $actorUserId
        );

        return true;
    }

    public function updateApprovedOffDay(
        BookingLeaveRequest $item,
        Carbon $startDate,
        Carbon $endDate,
        ?string $reason,
        ?int $actorUserId,
        ?string $remark = null
    ): ?BookingLeaveRequest {
        if ($item->leave_type !== 'off_day' || $item->status !== 'approved') {
            return null;
        }

        if ($this->hasOverlappingRequest((int) $item->staff_id, $startDate, $endDate, 'full_day', (int) $item->id)) {
            return null;
        }

        $before = $this->snapshotOffDay($item);
        $days = $this->calculateRequestedDays($startDate, $endDate, 'full_day');

        [$startAt, $endAt] = $this->resolveTimeoffWindow((int) $item->staff_id, $startDate, $endDate, 'full_day');

        if ($item->approvedTimeoff) {
            $item->approvedTimeoff->update([
                'start_at' => $startAt,
                'end_at' => $endAt,
                'reason' => sprintf('Off day #%d', $item->id),
            ]);
        } else {
            $timeoff = \App\Models\Booking\BookingStaffTimeoff::create([
                'staff_id' => $item->staff_id,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'reason' => sprintf('Off day #%d', $item->id),
            ]);
            $item->approved_timeoff_id = $timeoff->id;
        }

        $item->start_date = $startDate->toDateString();
        $item->end_date = $endDate->toDateString();
        $item->days = $days;
        if ($reason !== null) {
            $item->reason = $reason;
        }
        $item->save();

        $this->logAction(
            (int) $item->staff_id,
            (int) $item->id,
            'updated',
            $before,
            $this->snapshotOffDay($item->fresh()),
            $remark ?? 'Off day updated by admin.',
            $actorUserId
        );

        return $item->fresh(['staff:id,name', 'reviewer:id,name', 'creationLog.creator:id,name']);
    }

    /**
     * @return array{0: float, 1: float}
     */
    private function resolveDayPeriod(Carbon $date, Carbon $rangeStart, Carbon $rangeEnd, string $dayType): array
    {
        if (! $rangeStart->isSameDay($rangeEnd)) {
            return [0.0, 1.0];
        }

        return match ($dayType) {
            'half_day_am' => [0.0, 0.5],
            'half_day_pm' => [0.5, 1.0],
            default => [0.0, 1.0],
        };
    }
}
