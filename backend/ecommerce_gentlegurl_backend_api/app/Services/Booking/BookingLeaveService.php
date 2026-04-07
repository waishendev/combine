<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingLeaveBalance;
use App\Models\Booking\BookingLeaveRequest;

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
}
