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

    /**
     * Booking commission rows count only COMPLETED appointments that are fully paid (payment_status = PAID).
     */
    public function isBookingCommissionCountable(Booking $booking): bool
    {
        if ($booking->status !== 'COMPLETED') {
            return false;
        }

        return strtoupper((string) ($booking->payment_status ?? '')) === 'PAID';
    }

    /**
     * Keeps incremental booking commission in sync after status/payment changes:
     * counts when COMPLETED + PAID, removes when eligibility is lost but commission_counted_at is still set.
     */
    public function syncBookingCommissionState(Booking $booking): void
    {
        $booking->loadMissing('service');

        if ($this->isBookingCommissionCountable($booking)) {
            $this->applyCompletedBooking($booking);

            return;
        }

        if ($booking->commission_counted_at) {
            $this->reverseCompletedBooking($booking);
        }
    }

    public function applyCompletedBooking(Booking $booking): void
    {
        if (! $this->isBookingCommissionCountable($booking)) {
            return;
        }

        if ($booking->commission_counted_at) {
            return;
        }

        $completedAt = $booking->completed_at ?: now();
        $commissionRows = $this->resolveBookingIncrementalCommissionRows($booking);
        if ($commissionRows->isEmpty()) {
            return;
        }

        $year = (int) $completedAt->format('Y');
        $month = (int) $completedAt->format('m');
        $monthlyRows = $this->resolveOrCreateBookingMonthlyRows($commissionRows->pluck('staff_id')->unique()->values(), $year, $month);
        if ($monthlyRows->contains(fn (StaffMonthlySale $row) => $this->isFrozen($row))) {
            return;
        }

        foreach ($commissionRows as $row) {
            $staffId = (int) ($row['staff_id'] ?? 0);
            $splitSales = (float) ($row['split_sales'] ?? 0);
            $monthly = $monthlyRows->first(fn (StaffMonthlySale $monthlyRow) => (int) $monthlyRow->staff_id === $staffId);
            if (! $monthly || $splitSales <= 0) {
                continue;
            }
            $monthly->total_sales = (float) $monthly->total_sales + $splitSales;
            $monthly->booking_count = (int) $monthly->booking_count + 1;
            $monthly->save();
            $this->recalculateMonthly($monthly);
        }

        $booking->forceFill([
            'commission_counted_at' => now(),
            'completed_at' => $completedAt,
        ])->save();
    }

    public function reverseCompletedBooking(Booking $booking): void
    {
        if (! $booking->commission_counted_at) {
            return;
        }

        $completedAt = $booking->completed_at ?: Carbon::parse($booking->commission_counted_at);
        $commissionRows = $this->resolveBookingIncrementalCommissionRows($booking);
        if ($commissionRows->isEmpty()) {
            $booking->forceFill(['commission_counted_at' => null])->save();
            return;
        }

        $year = (int) $completedAt->format('Y');
        $month = (int) $completedAt->format('m');
        $monthlyRows = StaffMonthlySale::query()
            ->where('type', self::TYPE_BOOKING)
            ->whereIn('staff_id', $commissionRows->pluck('staff_id')->unique()->values()->all())
            ->where('year', $year)
            ->where('month', $month)
            ->get();

        if ($monthlyRows->isEmpty() || $monthlyRows->contains(fn (StaffMonthlySale $row) => $this->isFrozen($row))) {
            return;
        }

        foreach ($commissionRows as $row) {
            $staffId = (int) ($row['staff_id'] ?? 0);
            $splitSales = (float) ($row['split_sales'] ?? 0);
            $monthly = $monthlyRows->first(fn (StaffMonthlySale $monthlyRow) => (int) $monthlyRow->staff_id === $staffId);
            if (! $monthly || $splitSales <= 0) {
                continue;
            }
            $monthly->total_sales = max(0, (float) $monthly->total_sales - $splitSales);
            $monthly->booking_count = max(0, (int) $monthly->booking_count - 1);
            $monthly->save();
            $this->recalculateMonthly($monthly);
        }

        $booking->forceFill(['commission_counted_at' => null])->save();
    }

    public function resyncBookingCommission(Booking $booking): void
    {
        $booking->loadMissing('service');
        if ($booking->commission_counted_at) {
            $this->reverseCompletedBooking($booking->fresh(['service']));
        }
        $this->syncBookingCommissionState($booking->fresh(['service']));
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

        $bookingLineRows = $this->baseBookingOrderItemSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->selectRaw("COALESCE(SUM(({$this->effectiveLineTotalExpr()}) * (order_item_staff_splits.share_percent::numeric / 100)), 0) as total_sales")
            ->selectRaw('COUNT(order_item_staff_splits.id) as row_count')
            ->first();

        $totalSales = (float) ($bookingLineRows->total_sales ?? 0);
        $bookingCount = (int) ($bookingLineRows->row_count ?? 0);
        $totalSales = round($totalSales, 2);

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

        $staffIds = $this->baseBookingOrderItemSplitQuery($start, $nextMonthStart)
            ->pluck('order_item_staff_splits.staff_id')
            ->concat(
                StaffMonthlySale::query()
                    ->where('type', self::TYPE_BOOKING)
                    ->where('year', $year)
                    ->where('month', $month)
                    ->pluck('staff_id')
            )
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
            ->concat(
                StaffMonthlySale::query()
                    ->where('type', self::TYPE_ECOMMERCE)
                    ->where('year', $year)
                    ->where('month', $month)
                    ->pluck('staff_id')
            )
            ->filter()
            ->unique()
            ->values();

        $result = [];
        foreach ($staffIds as $staffId) {
            $result[] = $this->recalculateEcommerceForStaffMonth((int) $staffId, $year, $month, $force);
        }

        return $result;
    }


    private function baseBookingOrderItemSplitQuery(Carbon $start, Carbon $nextMonthStart)
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'])
            ->where('orders.created_at', '>=', $start)
            ->where('orders.created_at', '<', $nextMonthStart)
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');
    }

    private function baseEcommerceProductSplitQuery(Carbon $start, Carbon $nextMonthStart)
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('order_items.line_type', 'product')
            ->where('orders.created_at', '>=', $start)
            ->where('orders.created_at', '<', $nextMonthStart)
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
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
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');
    }

    private function effectiveLineTotalExpr(): string
    {
        return 'COALESCE(order_item_staff_splits.amount_basis, order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
    }

    private function resolveBookingCommissionableNetAmount(int $bookingId, float $fallback): float
    {
        if ($bookingId <= 0) {
            return round(max(0, $fallback), 2);
        }

        $net = (float) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.booking_id', $bookingId)
            ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->selectRaw('COALESCE(SUM(COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)), 0) as total')
            ->value('total');

        if ($net > 0.0001) {
            return round($net, 2);
        }

        return round(max(0, $fallback), 2);
    }

    private function resolveBookingNetTotalsByIds(array $bookingIds): array
    {
        $ids = collect($bookingIds)->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
        if (empty($ids)) {
            return [];
        }

        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.booking_id', $ids)
            ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->groupBy('order_items.booking_id')
            ->selectRaw('order_items.booking_id as booking_id')
            ->selectRaw('COALESCE(SUM(COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)), 0) as total')
            ->pluck('total', 'booking_id')
            ->map(fn ($total) => round((float) $total, 2))
            ->all();
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
        $bookingOrderMonths = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->when($staffId, fn ($query) => $query->where('order_item_staff_splits.staff_id', $staffId))
            ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'])
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->whereNotNull('orders.created_at')
            ->selectRaw('EXTRACT(YEAR FROM orders.created_at)::int AS year')
            ->selectRaw('EXTRACT(MONTH FROM orders.created_at)::int AS month')
            ->groupByRaw('EXTRACT(YEAR FROM orders.created_at), EXTRACT(MONTH FROM orders.created_at)')
            ->get()
            ->map(fn ($row) => ['year' => (int) $row->year, 'month' => (int) $row->month]);

        return $bookingOrderMonths
            ->unique(fn ($row) => $row['year'].'-'.$row['month'])
            ->sortBy([['year', 'asc'], ['month', 'asc']])
            ->values();
    }


    private function resolveBookingIncrementalCommissionRows(Booking $booking): Collection
    {
        $bookingId = (int) $booking->id;
        if ($bookingId <= 0) {
            return collect();
        }

        $lineRows = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('order_items.booking_id', $bookingId)
            ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'])
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->selectRaw('order_item_staff_splits.staff_id AS staff_id')
            ->selectRaw('order_item_staff_splits.share_percent AS share_percent')
            ->selectRaw("({$this->effectiveLineTotalExpr()}) AS amount_basis")
            ->selectRaw('order_items.line_type AS order_line_type')
            ->selectRaw('order_item_staff_splits.line_type AS split_line_type')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'share_percent' => (float) ($row->share_percent ?? 0),
                'amount_basis' => round((float) ($row->amount_basis ?? 0), 2),
                'split_sales' => round(((float) ($row->amount_basis ?? 0)) * (((float) ($row->share_percent ?? 0)) / 100), 2),
                'order_line_type' => (string) ($row->order_line_type ?? ''),
                'split_line_type' => (string) ($row->split_line_type ?? ''),
                'source' => 'order_item_staff_splits',
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0 && $row['amount_basis'] > 0)
            ->values();

        if ($lineRows->isNotEmpty()) {
            return $lineRows;
        }

        $servicePrice = $this->resolveBookingCommissionableNetAmount($bookingId, (float) optional($booking->service)->service_price);

        return $this->resolveBookingStaffSplits($booking)
            ->map(fn ($split) => [
                'staff_id' => (int) ($split['staff_id'] ?? 0),
                'share_percent' => (float) ($split['share_percent'] ?? 0),
                'amount_basis' => $servicePrice,
                'split_sales' => round($servicePrice * (((float) ($split['share_percent'] ?? 0)) / 100), 2),
                'order_line_type' => 'legacy_booking_total',
                'split_line_type' => 'legacy_booking_total',
                'source' => 'booking_service_staff_splits',
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0 && $row['amount_basis'] > 0)
            ->values();
    }

    private function resolveBookingStaffSplits(Booking $booking): Collection
    {
        $rows = DB::table('booking_service_staff_splits')
            ->where('booking_id', (int) $booking->id)
            ->orderBy('id')
            ->get(['staff_id', 'split_percent'])
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'share_percent' => (int) ($row->split_percent ?? 0),
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0)
            ->values();

        if ($rows->isNotEmpty()) {
            return $rows;
        }

        if ($booking->staff_id) {
            return collect([['staff_id' => (int) $booking->staff_id, 'share_percent' => 100]]);
        }

        return collect();
    }

    private function resolveOrCreateBookingMonthlyRows(Collection $staffIds, int $year, int $month): Collection
    {
        return $staffIds->map(function (int $staffId) use ($year, $month) {
            return StaffMonthlySale::query()->firstOrCreate(
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
        })->values();
    }

    private function resolveEcommerceMonths(?int $staffId = null): Collection
    {
        $productMonths = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('order_items.line_type', 'product')
            ->when($staffId, fn ($query) => $query->where('order_item_staff_splits.staff_id', $staffId))
            ->where(function ($query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
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
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
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

    public function monthRows(int $year, int $month, ?string $type = null): Collection
    {
        return StaffMonthlySale::query()
            ->where('type', $this->normalizeType($type))
            ->where('year', $year)
            ->where('month', $month)
            ->get();
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
