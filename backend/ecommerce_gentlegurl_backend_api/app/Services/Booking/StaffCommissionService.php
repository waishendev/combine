<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use Carbon\Carbon;

class StaffCommissionService
{
    public function recalculateForStaffMonth(int $staffId, int $year, int $month): StaffMonthlySale
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $bookings = Booking::query()
            ->with('service:id,service_price')
            ->where('staff_id', $staffId)
            ->where('status', 'COMPLETED')
            ->whereBetween('completed_at', [$start, $end])
            ->get();

        $totalSales = round((float) $bookings->sum(fn (Booking $booking) => (float) optional($booking->service)->service_price), 2);
        $bookingCount = $bookings->count();

        $monthly = StaffMonthlySale::query()->firstOrCreate(
            [
                'staff_id' => $staffId,
                'year' => $year,
                'month' => $month,
            ],
            [
                'total_sales' => 0,
                'booking_count' => 0,
                'tier_percent' => 0,
                'commission_amount' => 0,
                'is_overridden' => false,
            ]
        );

        $monthly->total_sales = $totalSales;
        $monthly->booking_count = $bookingCount;
        $monthly->save();

        return $this->recalculateMonthly($monthly);
    }

    public function recalculateForMonthAll(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $staffIds = Booking::query()
            ->where('status', 'COMPLETED')
            ->whereBetween('completed_at', [$start, $end])
            ->pluck('staff_id')
            ->filter()
            ->unique()
            ->values();

        $result = [];
        foreach ($staffIds as $staffId) {
            $result[] = $this->recalculateForStaffMonth((int) $staffId, $year, $month);
        }

        return $result;
    }

    public function applyCompletedBooking(Booking $booking): void
    {
        if ($booking->status !== 'COMPLETED' || !$booking->staff_id) {
            return;
        }

        if ($booking->commission_counted_at) {
            return;
        }

        $completedAt = $booking->completed_at ?: now();
        $servicePrice = (float) optional($booking->service)->service_price;

        $monthly = StaffMonthlySale::query()->firstOrCreate(
            [
                'staff_id' => $booking->staff_id,
                'year' => (int) $completedAt->format('Y'),
                'month' => (int) $completedAt->format('m'),
            ],
            [
                'total_sales' => 0,
                'booking_count' => 0,
                'tier_percent' => 0,
                'commission_amount' => 0,
                'is_overridden' => false,
            ]
        );

        $monthly->total_sales = (float) $monthly->total_sales + $servicePrice;
        $monthly->booking_count = (int) $monthly->booking_count + 1;

        $this->recalculateMonthly($monthly);

        $booking->forceFill([
            'commission_counted_at' => now(),
            'completed_at' => $completedAt,
        ])->save();
    }

    public function reverseCompletedBooking(Booking $booking): void
    {
        if (!$booking->commission_counted_at || !$booking->staff_id) {
            return;
        }

        $completedAt = $booking->completed_at ?: Carbon::parse($booking->commission_counted_at);
        $servicePrice = (float) optional($booking->service)->service_price;

        $monthly = StaffMonthlySale::query()
            ->where('staff_id', $booking->staff_id)
            ->where('year', (int) $completedAt->format('Y'))
            ->where('month', (int) $completedAt->format('m'))
            ->first();

        if (!$monthly) {
            $booking->forceFill(['commission_counted_at' => null])->save();
            return;
        }

        $monthly->total_sales = max(0, (float) $monthly->total_sales - $servicePrice);
        $monthly->booking_count = max(0, (int) $monthly->booking_count - 1);
        $this->recalculateMonthly($monthly);

        $booking->forceFill(['commission_counted_at' => null])->save();
    }

    public function recalculateMonthly(StaffMonthlySale $monthly): StaffMonthlySale
    {
        $tier = StaffCommissionTier::query()
            ->where('min_sales', '<=', $monthly->total_sales)
            ->orderByDesc('min_sales')
            ->first();

        $tierPercent = (float) ($tier?->commission_percent ?? 0);
        $commissionAmount = round(((float) $monthly->total_sales * $tierPercent) / 100, 2);

        $monthly->tier_percent = $tierPercent;
        if ($monthly->is_overridden) {
            $monthly->commission_amount = (float) ($monthly->override_amount ?? 0);
        } else {
            $monthly->commission_amount = $commissionAmount;
        }

        $monthly->save();

        return $monthly->refresh();
    }
}
