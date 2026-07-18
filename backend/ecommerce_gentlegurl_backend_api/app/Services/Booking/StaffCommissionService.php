<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\StaffCommissionLog;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Services\Ecommerce\StaffSplitNormalizer;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StaffCommissionService
{
    public const TYPE_BOOKING = 'BOOKING';
    public const TYPE_ECOMMERCE = 'ECOMMERCE';
    public const STATUS_OPEN = 'OPEN';
    public const STATUS_FROZEN = 'FROZEN';

    /** Paid booking lines that count toward staff booking sales (deposit + settlement + add-ons). */
    private const BOOKING_COMMISSION_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'];

    public static function isBookingCommissionLineType(?string $lineType): bool
    {
        return in_array(strtolower((string) $lineType), self::BOOKING_COMMISSION_LINE_TYPES, true);
    }

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

        // Step 1: Get amounts and booking IDs from order_item_staff_splits (most cases)
        $mainQueryRows = $this->baseBookingOrderItemSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->selectRaw('('.StaffSplitNormalizer::splitSalesSql('order_item_staff_splits', $this->effectiveLineTotalExpr()).') as split_sales')
            ->selectRaw('order_items.booking_id as booking_id')
            ->selectRaw('order_items.line_type as line_type')
            ->selectRaw('order_items.id as order_item_id')
            ->get();

        $totalSales = (float) $mainQueryRows->sum('split_sales');
        $settledBookingIds = $this->resolveSettledBookingIdsForMonth($start, $nextMonthStart);
        $alreadyCountedBookingIds = [];
        $countedProductItemIds = [];

        foreach ($mainQueryRows as $row) {
            $lineType = (string) ($row->line_type ?? '');
            if ($lineType === 'booking_product') {
                $orderItemId = (int) ($row->order_item_id ?? 0);
                if ($orderItemId > 0) {
                    $countedProductItemIds[$orderItemId] = true;
                }

                continue;
            }

            $bookingId = (int) ($row->booking_id ?? 0);
            if ($bookingId > 0 && isset($settledBookingIds[$bookingId])) {
                $alreadyCountedBookingIds[$bookingId] = true;
            }
        }

        $bookingCount = count($alreadyCountedBookingIds) + count($countedProductItemIds);

        // Step 2: Fallback for order_items WITHOUT order_item_staff_splits (e.g., online deposits)
        // These should use booking_service_staff_splits for attribution
        $lineTotal = 'COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
        $fallbackLineTotal = "GREATEST($lineTotal, " . $this->packageRedemptionLineValueExpr('order_items') . ")";

        $fallbackItemsQuery = $this->applyBaseOrderScope(
            DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
                ->whereNotNull('order_items.booking_id')
                ->where('orders.created_at', '>=', $start)
                ->where('orders.created_at', '<', $nextMonthStart)
                ->whereNotExists(function ($sub) {
                    $sub->selectRaw('1')
                        ->from('order_item_staff_splits')
                        ->whereColumn('order_item_staff_splits.order_item_id', 'order_items.id');
                })
        );
        $this->excludePackageRefundedBookingDeposits($fallbackItemsQuery);
        $fallbackItems = $fallbackItemsQuery
            ->selectRaw('order_items.booking_id as booking_id')
            ->selectRaw("SUM($fallbackLineTotal) as line_amount")
            ->groupBy('order_items.booking_id')
            ->get();

        if ($fallbackItems->isNotEmpty()) {
            $fallbackBookingIds = $fallbackItems->pluck('booking_id')->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values()->all();

            // Get staff splits from booking_service_staff_splits
            $bookingSplits = DB::table('booking_service_staff_splits')
                ->whereIn('booking_id', $fallbackBookingIds)
                ->where('staff_id', $staffId)
                ->get(['booking_id', 'split_percent', 'share_amount'])
                ->keyBy('booking_id');

            // Fallback to bookings.staff_id if no explicit splits
            $bookingPrimaryStaff = DB::table('bookings')
                ->whereIn('id', $fallbackBookingIds)
                ->where('staff_id', $staffId)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->flip()
                ->all();

            foreach ($fallbackItems as $item) {
                $bookingId = (int) $item->booking_id;
                $lineAmount = (float) $item->line_amount;

                $split = $bookingSplits->get($bookingId);
                if ($split) {
                    $shareAmount = (float) ($split->share_amount ?? 0);
                    $sharePercent = (float) $split->split_percent;
                    $totalSales += $shareAmount > 0
                        ? $shareAmount
                        : $lineAmount * ($sharePercent / 100);
                    // Only count settled bookings not already counted from main query
                    if (isset($settledBookingIds[$bookingId]) && ! isset($alreadyCountedBookingIds[$bookingId])) {
                        $alreadyCountedBookingIds[$bookingId] = true;
                        $bookingCount++;
                    }
                } elseif (isset($bookingPrimaryStaff[$bookingId])) {
                    // Booking's primary staff matches - give 100%
                    $totalSales += $lineAmount;
                    // Only count settled bookings not already counted from main query
                    if (isset($settledBookingIds[$bookingId]) && ! isset($alreadyCountedBookingIds[$bookingId])) {
                        $alreadyCountedBookingIds[$bookingId] = true;
                        $bookingCount++;
                    }
                }
            }
        }

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

    /**
     * Apply base order scope for fallback queries without order_item_staff_splits join.
     */
    private function applyBaseOrderScope($query)
    {
        return $query
            ->where(function ($q) {
                $q->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function ($q) {
                $q->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');
    }

    private function orderBillAtSql(string $alias = 'orders'): string
    {
        return "COALESCE({$alias}.placed_at, {$alias}.created_at)";
    }

    /**
     * Bookings with a settlement order in the month. Deposit-only bookings are excluded,
     * matching SalesVisualDailyReportService::bookingStaffCommissionSales().
     *
     * @return array<int, true>
     */
    private function resolveSettledBookingIdsForMonth(Carbon $start, Carbon $nextMonthStart): array
    {
        return $this->applyBaseOrderScope(
            DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.line_type', 'booking_settlement')
                ->whereBetween(DB::raw($this->orderBillAtSql('orders')), [$start, $nextMonthStart])
                ->whereNotNull('order_items.booking_id')
        )
            ->pluck('order_items.booking_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->flip()
            ->all();
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

        $splitSalesExpr = StaffSplitNormalizer::splitSalesSql(
            'order_item_staff_splits',
            $this->effectiveLineTotalExpr(),
        );
        // Total Sales = attributed split sales (same as sales visual / booking monthly).
        // Tier % is applied later in recalculateMonthly — do not multiply by per-staff product rate here.
        $productSales = (float) $this->baseEcommerceProductSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->selectRaw("COALESCE(SUM({$splitSalesExpr}), 0) AS total_sales")
            ->value('total_sales');

        $productCount = (int) $this->baseEcommerceProductSplitQuery($start, $nextMonthStart)
            ->where('order_item_staff_splits.staff_id', $staffId)
            ->count('order_item_staff_splits.id');

        $packageSales = (float) $this->baseEcommercePackageSplitQuery($start, $nextMonthStart)
            ->where('service_package_staff_splits.staff_id', $staffId)
            ->selectRaw('COALESCE(SUM(service_package_staff_splits.split_sales_amount::numeric), 0) AS total_sales')
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
        $query = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->whereIn('order_items.line_type', self::BOOKING_COMMISSION_LINE_TYPES)
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

        return $this->excludePackageRefundedBookingDeposits($query);
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

    private function packageRedemptionLineValueExpr(string $orderItemAlias = 'order_items'): string
    {
        $netExpr = "COALESCE($orderItemAlias.line_total_after_discount, $orderItemAlias.effective_line_total, $orderItemAlias.line_total, 0)::numeric";
        $grossExpr = "COALESCE($orderItemAlias.line_total_snapshot, $orderItemAlias.line_total, 0)::numeric";

        return "(CASE WHEN $orderItemAlias.line_type IN ('booking_settlement','booking_addon') AND $orderItemAlias.booking_id IS NOT NULL AND $orderItemAlias.booking_service_id IS NOT NULL AND $netExpr <= 0.0001 AND $grossExpr > 0.0001 THEN COALESCE((SELECT COALESCE(spi.redemption_value, 0)::numeric * GREATEST(1, COALESCE($orderItemAlias.quantity, 1))::numeric FROM customer_service_package_usages u JOIN customer_service_packages csp ON csp.id = u.customer_service_package_id JOIN service_package_items spi ON spi.service_package_id = csp.service_package_id AND spi.booking_service_id = u.booking_service_id WHERE u.booking_service_id = $orderItemAlias.booking_service_id AND u.status IN ('reserved','consumed') AND (u.booking_id = $orderItemAlias.booking_id OR (u.used_from = 'POS' AND u.used_ref_id = $orderItemAlias.booking_id)) ORDER BY u.id LIMIT 1), 0) ELSE 0 END)::numeric";
    }

    /**
     * Package settlement returns the previously collected deposit. The package
     * redemption value, rather than redemption value + deposit, drives commission.
     */
    private function excludePackageRefundedBookingDeposits($query, string $orderItemAlias = 'order_items')
    {
        $packageValue = $this->packageRedemptionLineValueExpr('package_claim_item');

        return $query->where(function ($scope) use ($orderItemAlias, $packageValue) {
            $scope->where("{$orderItemAlias}.line_type", '!=', 'booking_deposit')
                ->orWhereNotExists(function ($packageClaim) use ($orderItemAlias, $packageValue) {
                    $packageClaim->selectRaw('1')
                        ->from('order_items as package_claim_item')
                        ->whereColumn('package_claim_item.booking_id', "{$orderItemAlias}.booking_id")
                        ->whereRaw("($packageValue) > 0.0001");
                });
        });
    }

    private function effectiveLineTotalExpr(): string
    {
        $lineTotalExpr = 'COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
        $optionTotalExpr = "COALESCE((SELECT SUM(COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(order_items.quantity, 1)::numeric, 0)) FROM jsonb_array_elements(COALESCE(order_items.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option)), 0)";
        $matchingOptionExpr = "COALESCE((SELECT COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(order_items.quantity, 1)::numeric, 0) FROM jsonb_array_elements(COALESCE(order_items.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option) WHERE option_row.option->>'id' = order_item_staff_splits.line_ref_id LIMIT 1), order_item_staff_splits.amount_basis)";

        return "(CASE WHEN order_items.line_type = 'booking_product' AND order_item_staff_splits.line_type = 'booking_product_base' THEN GREATEST(0, ($lineTotalExpr) - ($optionTotalExpr)) WHEN order_items.line_type = 'booking_product' AND order_item_staff_splits.line_type = 'booking_product_option' THEN COALESCE($matchingOptionExpr, order_item_staff_splits.amount_basis, $lineTotalExpr) ELSE COALESCE(order_item_staff_splits.amount_basis, $lineTotalExpr) END)::numeric";
    }

    private function resolveBookingCommissionableNetAmount(int $bookingId, float $fallback): float
    {
        if ($bookingId <= 0) {
            return round(max(0, $fallback), 2);
        }

        $net = (float) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.booking_id', $bookingId)
            ->whereIn('order_items.line_type', ['booking_settlement', 'booking_addon'])
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
            ->whereIn('order_items.line_type', ['booking_settlement', 'booking_addon'])
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
            ->whereIn('order_items.line_type', ['booking_settlement', 'booking_addon', 'booking_product'])
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

        // Step 1: Get rows from order_item_staff_splits (lines that have explicit splits)
        $lineRowsQuery = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->where('order_items.booking_id', $bookingId)
            ->whereIn('order_items.line_type', self::BOOKING_COMMISSION_LINE_TYPES)
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
        $this->excludePackageRefundedBookingDeposits($lineRowsQuery);
        $lineRows = $lineRowsQuery
            ->selectRaw('order_item_staff_splits.staff_id AS staff_id')
            ->selectRaw('order_item_staff_splits.share_percent AS share_percent')
            ->selectRaw('order_item_staff_splits.share_amount AS share_amount')
            ->selectRaw("({$this->effectiveLineTotalExpr()}) AS amount_basis")
            ->selectRaw('order_items.line_type AS order_line_type')
            ->selectRaw('order_item_staff_splits.line_type AS split_line_type')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'share_percent' => (float) ($row->share_percent ?? 0),
                'amount_basis' => round((float) ($row->amount_basis ?? 0), 2),
                'split_sales' => round((float) ($row->share_amount ?? 0) > 0
                    ? (float) $row->share_amount
                    : ((float) ($row->amount_basis ?? 0)) * (((float) ($row->share_percent ?? 0)) / 100), 2),
                'order_line_type' => (string) ($row->order_line_type ?? ''),
                'split_line_type' => (string) ($row->split_line_type ?? ''),
                'source' => 'order_item_staff_splits',
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && (($row['share_percent'] ?? 0) > 0 || ($row['split_sales'] ?? 0) > 0) && ($row['amount_basis'] ?? 0) > 0)
            ->values();

        // Step 2: Also check for order_items WITHOUT order_item_staff_splits (e.g., online deposits)
        // These should use booking_service_staff_splits for attribution
        $lineTotal = 'COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
        $fallbackLineTotal = "GREATEST($lineTotal, " . $this->packageRedemptionLineValueExpr('order_items') . ")";

        $fallbackItemsQuery = $this->applyBaseOrderScope(
            DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.booking_id', $bookingId)
                ->whereIn('order_items.line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
                ->whereNotExists(function ($sub) {
                    $sub->selectRaw('1')
                        ->from('order_item_staff_splits')
                        ->whereColumn('order_item_staff_splits.order_item_id', 'order_items.id');
                })
        );
        $this->excludePackageRefundedBookingDeposits($fallbackItemsQuery);
        $fallbackItems = $fallbackItemsQuery
            ->selectRaw('order_items.id as order_item_id')
            ->selectRaw('order_items.line_type as line_type')
            ->selectRaw("$fallbackLineTotal as line_amount")
            ->get();

        if ($fallbackItems->isNotEmpty()) {
            $bookingSplits = $this->resolveBookingStaffSplits($booking);

            foreach ($fallbackItems as $item) {
                $lineAmount = (float) $item->line_amount;
                $lineType = (string) $item->line_type;

                foreach ($bookingSplits as $split) {
                    $staffId = (int) ($split['staff_id'] ?? 0);
                    $shareAmount = (float) ($split['share_amount'] ?? 0);
                    $sharePercent = (float) ($split['share_percent'] ?? 0);

                    if ($staffId <= 0 || $lineAmount <= 0 || ($shareAmount <= 0 && $sharePercent <= 0)) {
                        continue;
                    }

                    $splitSales = $shareAmount > 0
                        ? round($shareAmount, 2)
                        : round($lineAmount * ($sharePercent / 100), 2);

                    $lineRows->push([
                        'staff_id' => $staffId,
                        'share_percent' => $sharePercent,
                        'amount_basis' => round($lineAmount, 2),
                        'split_sales' => $splitSales,
                        'order_line_type' => $lineType,
                        'split_line_type' => 'fallback_from_booking_splits',
                        'source' => 'booking_service_staff_splits',
                    ]);
                }
            }
        }

        // If still empty after all attempts, use legacy fallback with total booking amount
        if ($lineRows->isEmpty()) {
            $servicePrice = $this->resolveBookingCommissionableNetAmount($bookingId, (float) optional($booking->service)->service_price);

            return $this->resolveBookingStaffSplits($booking)
                ->map(fn ($split) => [
                    'staff_id' => (int) ($split['staff_id'] ?? 0),
                    'share_percent' => (float) ($split['share_percent'] ?? 0),
                    'amount_basis' => $servicePrice,
                    'split_sales' => ((float) ($split['share_amount'] ?? 0)) > 0
                        ? round((float) $split['share_amount'], 2)
                        : round($servicePrice * (((float) ($split['share_percent'] ?? 0)) / 100), 2),
                    'order_line_type' => 'legacy_booking_total',
                    'split_line_type' => 'legacy_booking_total',
                    'source' => 'booking_service_staff_splits',
                ])
                ->filter(fn (array $row) => $row['staff_id'] > 0 && (($row['share_percent'] ?? 0) > 0 || ($row['split_sales'] ?? 0) > 0) && ($row['amount_basis'] ?? 0) > 0)
                ->values();
        }

        return $lineRows;
    }

    private function resolveBookingStaffSplits(Booking $booking): Collection
    {
        $rows = DB::table('booking_service_staff_splits')
            ->where('booking_id', (int) $booking->id)
            ->orderBy('id')
            ->get(['staff_id', 'split_percent', 'share_amount'])
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'share_percent' => (int) ($row->split_percent ?? 0),
                'share_amount' => $row->share_amount !== null ? round((float) $row->share_amount, 2) : null,
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && ($row['share_percent'] > 0 || ($row['share_amount'] ?? 0) > 0))
            ->values();

        if ($rows->isNotEmpty()) {
            return $rows;
        }

        if ($booking->staff_id) {
            return collect([['staff_id' => (int) $booking->staff_id, 'share_percent' => 100, 'share_amount' => null]]);
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
