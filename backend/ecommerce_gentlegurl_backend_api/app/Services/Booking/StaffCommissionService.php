<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StaffCommissionService
{
    public const TYPE_BOOKING = 'BOOKING';
    public const TYPE_ECOMMERCE = 'ECOMMERCE';

    public function normalizeType(?string $type): string
    {
        $normalized = strtoupper((string) $type);

        return in_array($normalized, [self::TYPE_BOOKING, self::TYPE_ECOMMERCE], true)
            ? $normalized
            : self::TYPE_BOOKING;
    }

    public function recalculateForStaffMonth(int $staffId, int $year, int $month, ?string $type = null): StaffMonthlySale
    {
        $resolvedType = $this->normalizeType($type);

        return $resolvedType === self::TYPE_ECOMMERCE
            ? $this->recalculateEcommerceForStaffMonth($staffId, $year, $month)
            : $this->recalculateBookingForStaffMonth($staffId, $year, $month);
    }

    public function recalculateForMonthAll(int $year, int $month, ?string $type = null): array
    {
        $resolvedType = $this->normalizeType($type);

        return $resolvedType === self::TYPE_ECOMMERCE
            ? $this->recalculateEcommerceForMonthAll($year, $month)
            : $this->recalculateBookingForMonthAll($year, $month);
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
                'type' => self::TYPE_BOOKING,
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
            ->where('type', self::TYPE_BOOKING)
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
        $resolvedType = $this->normalizeType((string) ($monthly->type ?? self::TYPE_BOOKING));

        $tier = StaffCommissionTier::query()
            ->where('type', $resolvedType)
            ->where('min_sales', '<=', $monthly->total_sales)
            ->orderByDesc('min_sales')
            ->first();

        $tierPercent = (float) ($tier?->commission_percent ?? 0);
        $commissionAmount = round(((float) $monthly->total_sales * $tierPercent) / 100, 2);

        $monthly->type = $resolvedType;
        $monthly->tier_percent = $tierPercent;
        if ($monthly->is_overridden) {
            $monthly->commission_amount = (float) ($monthly->override_amount ?? 0);
        } else {
            $monthly->commission_amount = $commissionAmount;
        }

        $monthly->save();

        return $monthly->refresh();
    }

    private function recalculateBookingForStaffMonth(int $staffId, int $year, int $month): StaffMonthlySale
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $nextMonthStart = $start->copy()->addMonth();

        $bookings = Booking::query()
            ->with('service:id,service_price')
            ->where('staff_id', $staffId)
            ->where('status', 'COMPLETED')
            ->where('completed_at', '>=', $start)
            ->where('completed_at', '<', $nextMonthStart)
            ->get();

        $totalSales = round((float) $bookings->sum(fn (Booking $booking) => (float) optional($booking->service)->service_price), 2);
        $bookingCount = $bookings->count();

        $monthly = StaffMonthlySale::query()->firstOrCreate(
            [
                'type' => self::TYPE_BOOKING,
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

    private function recalculateBookingForMonthAll(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $nextMonthStart = $start->copy()->addMonth();

        $staffIds = Booking::query()
            ->where('status', 'COMPLETED')
            ->where('completed_at', '>=', $start)
            ->where('completed_at', '<', $nextMonthStart)
            ->pluck('staff_id')
            ->filter()
            ->unique()
            ->values();

        $result = [];
        foreach ($staffIds as $staffId) {
            $result[] = $this->recalculateBookingForStaffMonth((int) $staffId, $year, $month);
        }

        return $result;
    }

    private function recalculateEcommerceForStaffMonth(int $staffId, int $year, int $month): StaffMonthlySale
    {
        [$start, $nextMonthStart] = $this->monthWindow($year, $month);

        $productSales = (float) $this->baseEcommerceProductSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->selectRaw("COALESCE(SUM(({$this->effectiveLineTotalExpr()}) * (order_item_staff_splits.share_percent::numeric / 100) * ({$this->productCommissionRateExpr()})), 0) AS total_sales")
            ->value('total_sales');

        $productCount = (int) $this->baseEcommerceProductSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->count('order_item_staff_splits.id');

        $packageSales = (float) $this->baseEcommercePackageSplitQuery($start, $nextMonthStart)
            ->where('service_package_staff_splits.staff_id', $staffId)
            ->selectRaw("COALESCE(SUM((service_package_staff_splits.split_sales_amount::numeric) * ({$this->servicePackageCommissionRateExpr()})), 0) AS total_sales")
            ->value('total_sales');

        $packageCount = (int) $this->baseEcommercePackageSplitQuery($start, $nextMonthStart)
            ->where('service_package_staff_splits.staff_id', $staffId)
            ->count('service_package_staff_splits.id');

        $monthly = StaffMonthlySale::query()->firstOrCreate(
            [
                'type' => self::TYPE_ECOMMERCE,
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

        $monthly->total_sales = round($productSales + $packageSales, 2);
        $monthly->booking_count = $productCount + $packageCount;
        $monthly->save();

        return $this->recalculateMonthly($monthly);
    }

    private function recalculateEcommerceForMonthAll(int $year, int $month): array
    {
        [$start, $nextMonthStart] = $this->monthWindow($year, $month);

        $productStaffIds = $this->baseEcommerceProductSplitQuery($start, $nextMonthStart)
            ->pluck('order_item_staff_splits.staff_id');

        $packageStaffIds = $this->baseEcommercePackageSplitQuery($start, $nextMonthStart)
            ->pluck('service_package_staff_splits.staff_id');

        $staffIds = collect($productStaffIds)
            ->concat($packageStaffIds)
            ->filter()
            ->unique()
            ->values();

        $result = [];
        foreach ($staffIds as $staffId) {
            $result[] = $this->recalculateEcommerceForStaffMonth((int) $staffId, $year, $month);
        }

        return $result;
    }

    private function baseEcommerceProductSplitQuery(Carbon $start, Carbon $nextMonthStart)
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('orders.created_at', '>=', $start)
            ->where('orders.created_at', '<', $nextMonthStart)
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');
    }

    private function baseEcommercePackageSplitQuery(Carbon $start, Carbon $nextMonthStart)
    {
        return DB::table('orders')
            ->join('customer_service_packages', function ($join) {
                $join->on('customer_service_packages.purchased_ref_id', '=', 'orders.id')
                    ->where('customer_service_packages.purchased_from', 'POS');
            })
            ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
            ->where('orders.created_at', '>=', $start)
            ->where('orders.created_at', '<', $nextMonthStart)
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');
    }

    private function effectiveLineTotalExpr(): string
    {
        return 'COALESCE(order_items.effective_line_total, order_items.line_total)::numeric';
    }

    private function productCommissionRateExpr(): string
    {
        return '(CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END)';
    }

    private function servicePackageCommissionRateExpr(): string
    {
        return '(CASE WHEN COALESCE(service_package_staff_splits.service_commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(service_package_staff_splits.service_commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(service_package_staff_splits.service_commission_rate_snapshot, 0)::numeric END)';
    }

    private function monthWindow(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();

        return [$start, $start->copy()->addMonth()];
    }
}
