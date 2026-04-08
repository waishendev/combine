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
        $types = ['annual', 'mc', 'off_day'];

        $entitlements = BookingLeaveBalance::query()
            ->where('staff_id', $staffId)
            ->get()
            ->keyBy('leave_type');

        $usedByType = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->where('status', 'approved')
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
        $summary = collect($this->getBalanceSummaryForStaff($staffId));

        return (float) ($summary->firstWhere('leave_type', 'annual')['remaining_days'] ?? 0);
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
