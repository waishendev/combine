<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\StaffCommissionLog;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StaffCommissionService
{
    public const TYPE_BOOKING = 'BOOKING';
    public const TYPE_ECOMMERCE = 'ECOMMERCE';
    public const STATUS_OPEN = 'OPEN';
    public const STATUS_FROZEN = 'FROZEN';

    public function normalizeType(?string $type): string
    {
        $normalized = strtoupper((string) $type);

        return in_array($normalized, [self::TYPE_BOOKING, self::TYPE_ECOMMERCE], true)
            ? $normalized
            : self::TYPE_BOOKING;
    }

    public function recalculateForStaffMonth(int $staffId, int $year, int $month, ?string $type = null, bool $force = false): StaffMonthlySale
    {
        $resolvedType = $this->normalizeType($type);

        return $resolvedType === self::TYPE_ECOMMERCE
            ? $this->recalculateEcommerceForStaffMonth($staffId, $year, $month, $force)
            : $this->recalculateBookingForStaffMonth($staffId, $year, $month, $force);
    }

    public function recalculateForMonthAll(int $year, int $month, ?string $type = null, bool $force = false): array
    {
        $resolvedType = $this->normalizeType($type);

        return $resolvedType === self::TYPE_ECOMMERCE
            ? $this->recalculateEcommerceForMonthAll($year, $month, $force)
            : $this->recalculateBookingForMonthAll($year, $month, $force);
    }

    public function recalculateAllMonths(?int $staffId = null, ?string $type = null, bool $force = false): array
    {
        $resolvedType = $this->normalizeType($type);
        $months = $resolvedType === self::TYPE_ECOMMERCE
            ? $this->resolveEcommerceMonths($staffId)
            : $this->resolveBookingMonths($staffId);

        $results = [];
        foreach ($months as $month) {
            $year = (int) $month['year'];
            $monthValue = (int) $month['month'];

            if ($staffId) {
                $results[] = $this->recalculateForStaffMonth($staffId, $year, $monthValue, $resolvedType, $force);
            } else {
                $rows = $this->recalculateForMonthAll($year, $monthValue, $resolvedType, $force);
                array_push($results, ...$rows);
            }
        }

        return $results;
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
                'status' => self::STATUS_OPEN,
            ]
        );

        $monthly->total_sales = (float) $monthly->total_sales + $servicePrice;
        $monthly->booking_count = (int) $monthly->booking_count + 1;

        if ($this->isFrozen($monthly)) {
            return;
        }

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

        if ($this->isFrozen($monthly)) {
            return;
        }

        $this->recalculateMonthly($monthly);

        $booking->forceFill(['commission_counted_at' => null])->save();
    }

    public function recalculateMonthly(StaffMonthlySale $monthly, bool $force = false): StaffMonthlySale
    {
        $resolvedType = $this->normalizeType((string) ($monthly->type ?? self::TYPE_BOOKING));
        if (! $force && $this->isFrozen($monthly)) {
            return $monthly->refresh();
        }

        $tier = StaffCommissionTier::query()
            ->where('type', $resolvedType)
            ->where('min_sales', '<=', $monthly->total_sales)
            ->orderByDesc('min_sales')
            ->first();

        $tierPercent = (float) ($tier?->commission_percent ?? 0);
        $commissionAmount = round(((float) $monthly->total_sales * $tierPercent) / 100, 2);

        $monthly->type = $resolvedType;
        $monthly->tier_percent = $tierPercent;
        $monthly->tier_id_snapshot = $tier?->id;
        $monthly->tier_percent_snapshot = $tierPercent;
        $monthly->tier_min_sales_snapshot = (float) ($tier?->min_sales ?? 0);
        $monthly->calculated_at = now();
        if ($monthly->is_overridden) {
            $monthly->commission_amount = (float) ($monthly->override_amount ?? 0);
        } else {
            $monthly->commission_amount = $commissionAmount;
        }

        $monthly->save();

        return $monthly->refresh();
    }

    private function recalculateBookingForStaffMonth(int $staffId, int $year, int $month, bool $force = false): StaffMonthlySale
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
                'status' => self::STATUS_OPEN,
            ]
        );

        if (! $force && $this->isFrozen($monthly)) {
            return $monthly->refresh();
        }

        $monthly->total_sales = $totalSales;
        $monthly->booking_count = $bookingCount;
        $monthly->save();

        return $this->recalculateMonthly($monthly, $force);
    }

    private function recalculateBookingForMonthAll(int $year, int $month, bool $force = false): array
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
            $result[] = $this->recalculateBookingForStaffMonth((int) $staffId, $year, $month, $force);
        }

        return $result;
    }

    private function recalculateEcommerceForStaffMonth(int $staffId, int $year, int $month, bool $force = false): StaffMonthlySale
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
                'status' => self::STATUS_OPEN,
            ]
        );

        if (! $force && $this->isFrozen($monthly)) {
            return $monthly->refresh();
        }

        $monthly->total_sales = round($productSales + $packageSales, 2);
        $monthly->booking_count = $productCount + $packageCount;
        $monthly->save();

        return $this->recalculateMonthly($monthly, $force);
    }

    private function recalculateEcommerceForMonthAll(int $year, int $month, bool $force = false): array
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
            $result[] = $this->recalculateEcommerceForStaffMonth((int) $staffId, $year, $month, $force);
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

    private function resolveBookingMonths(?int $staffId = null): Collection
    {
        return Booking::query()
            ->where('status', 'COMPLETED')
            ->when($staffId, fn ($query) => $query->where('staff_id', $staffId))
            ->whereNotNull('completed_at')
            ->selectRaw('EXTRACT(YEAR FROM completed_at)::int AS year')
            ->selectRaw('EXTRACT(MONTH FROM completed_at)::int AS month')
            ->groupByRaw('EXTRACT(YEAR FROM completed_at), EXTRACT(MONTH FROM completed_at)')
            ->orderBy('year')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'year' => (int) $row->year,
                'month' => (int) $row->month,
            ]);
    }

    private function resolveEcommerceMonths(?int $staffId = null): Collection
    {
        $productMonths = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->when($staffId, fn ($query) => $query->where('order_item_staff_splits.staff_id', $staffId))
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->selectRaw('EXTRACT(YEAR FROM orders.created_at)::int AS year')
            ->selectRaw('EXTRACT(MONTH FROM orders.created_at)::int AS month')
            ->groupByRaw('EXTRACT(YEAR FROM orders.created_at), EXTRACT(MONTH FROM orders.created_at)')
            ->get();

        $packageMonths = DB::table('orders')
            ->join('customer_service_packages', function ($join) {
                $join->on('customer_service_packages.purchased_ref_id', '=', 'orders.id')
                    ->where('customer_service_packages.purchased_from', 'POS');
            })
            ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
            ->when($staffId, fn ($query) => $query->where('service_package_staff_splits.staff_id', $staffId))
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->selectRaw('EXTRACT(YEAR FROM orders.created_at)::int AS year')
            ->selectRaw('EXTRACT(MONTH FROM orders.created_at)::int AS month')
            ->groupByRaw('EXTRACT(YEAR FROM orders.created_at), EXTRACT(MONTH FROM orders.created_at)')
            ->get();

        return collect($productMonths)
            ->concat($packageMonths)
            ->map(fn ($row) => ['year' => (int) $row->year, 'month' => (int) $row->month])
            ->unique(fn ($month) => $month['year'] . '-' . $month['month'])
            ->sortBy(fn ($month) => sprintf('%04d-%02d', $month['year'], $month['month']))
            ->values();
    }

    public function freezeMonthly(StaffMonthlySale $monthly, ?int $performedBy = null): StaffMonthlySale
    {
        if ($monthly->status !== self::STATUS_FROZEN) {
            $monthly->status = self::STATUS_FROZEN;
            $monthly->frozen_at = now();
            $monthly->frozen_by = $performedBy;
            $monthly->save();
        }

        return $monthly->refresh();
    }

    public function reopenMonthly(StaffMonthlySale $monthly, ?int $performedBy = null): StaffMonthlySale
    {
        $monthly->status = self::STATUS_OPEN;
        $monthly->reopened_at = now();
        $monthly->reopened_by = $performedBy;
        $monthly->save();

        return $monthly->refresh();
    }

    public function isFrozen(StaffMonthlySale $monthly): bool
    {
        return strtoupper((string) ($monthly->status ?? self::STATUS_OPEN)) === self::STATUS_FROZEN;
    }

    public function logAction(
        string $action,
        StaffMonthlySale $monthly,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $performedBy = null,
        ?string $remarks = null
    ): void {
        StaffCommissionLog::query()->create([
            'staff_monthly_sale_id' => $monthly->id,
            'staff_id' => $monthly->staff_id,
            'type' => $monthly->type,
            'year' => $monthly->year,
            'month' => $monthly->month,
            'action' => strtoupper($action),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'remarks' => $remarks,
            'performed_by' => $performedBy,
        ]);
    }
}
