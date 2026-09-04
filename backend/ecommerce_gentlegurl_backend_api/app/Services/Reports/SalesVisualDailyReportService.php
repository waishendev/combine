<?php

namespace App\Services\Reports;

use App\Models\Ecommerce\PaymentGateway;
use App\Services\Ecommerce\StaffSplitNormalizer;
use App\Support\WorkspaceType;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Single-day CRM dashboard aggregates for the sales visual report (cards + staff).
 * Kept separate from SalesChannelReportService to avoid widening visibility of private query builders.
 */
class SalesVisualDailyReportService
{
    private bool $includeVoidOrders = false;

    public function includeVoidOrders(bool $includeVoid): self
    {
        $this->includeVoidOrders = $includeVoid;

        return $this;
    }

    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product', 'service_package'];

    /** Booking lines attributed to staff sales once a booking is settled (includes prior deposits). */
    private const BOOKING_STAFF_SALES_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon'];

    private function orderBillAtSql(string $alias = 'o'): string
    {
        return "COALESCE({$alias}.placed_at, {$alias}.created_at)";
    }

    /**
     * Apply the same order-inclusion logic used by POS Summary so that online booking orders
     * (which may have status=pending + payment_status=paid) are counted.
     */
    private function applyOrderScope(Builder $q, string $alias = 'o'): Builder
    {
        // The Order is the immutable earning/sale Branch.  Keep this at the common
        // boundary so item-type and Staff queries cannot accidentally apply only
        // status/date constraints while payment queries are Branch scoped.
        ReportBranchScope::applyCurrent($q, "{$alias}.store_location_id");

        $q->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.status", 'completed')
                    ->orWhere("{$alias}.payment_status", 'paid');
            })
            ->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.payment_status", '!=', 'refunded')
                    ->orWhereNull("{$alias}.payment_status");
            })
            ->whereNull("{$alias}.refunded_at");

        if (! $this->includeVoidOrders) {
            $q->whereNotIn("{$alias}.status", ['cancelled', 'draft', 'voided']);
        }

        return $q;
    }

    public function salesSummary(int $year, ?int $month = null): array
    {
        if ($month !== null) {
            return $this->dailySalesSummary($year, $month);
        }

        return $this->monthlySalesSummary($year);
    }

    /**
     * One summary row per year for a multi-year range.
     */
    public function yearlySalesSummary(int $yearFrom, int $yearTo): array
    {
        if ($yearTo < $yearFrom) {
            [$yearFrom, $yearTo] = [$yearTo, $yearFrom];
        }

        $start = Carbon::create($yearFrom, 1, 1)->startOfDay();
        $end = Carbon::create($yearTo, 12, 31)->endOfDay();
        $rows = [];

        for ($year = $yearFrom; $year <= $yearTo; $year++) {
            $rows[$year] = [
                'year' => $year,
                'month' => $year,
                'month_name' => (string) $year,
                'ecommerce_orders' => 0,
                'booking_count' => 0,
                'ecommerce_sales' => 0.0,
                'booking_sales' => 0.0,
                'refund' => 0.0,
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'EXTRACT(YEAR FROM ' . $this->orderBillAtSql() . ')::int';
        $refundBucketExpression = 'EXTRACT(YEAR FROM COALESCE(processed_at, created_at))::int';

        foreach ($this->ecommerceSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['ecommerce_orders'] = (int) $row->ecommerce_orders;
            $rows[$key]['ecommerce_sales'] = round((float) $row->ecommerce_sales, 2);
        }

        foreach ($this->bookingSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['booking_count'] = (int) $row->booking_count;
            $rows[$key]['booking_sales'] = round((float) $row->booking_sales, 2);
        }

        foreach ($this->refundSummaryRows($start, $end, $refundBucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['refund'] = round((float) $row->refund, 2);
        }

        $payload = $this->salesSummaryPayload($yearFrom, null, array_values($rows));
        $payload['year_from'] = $yearFrom;
        $payload['year_to'] = $yearTo;
        $payload['mode'] = 'yearly';

        return $payload;
    }

    /**
     * Daily rows spanning one or more months within a year.
     */
    public function dailySalesSummaryRange(int $year, int $monthFrom, int $monthTo): array
    {
        if ($monthTo < $monthFrom) {
            [$monthFrom, $monthTo] = [$monthTo, $monthFrom];
        }
        $monthFrom = max(1, min(12, $monthFrom));
        $monthTo = max(1, min(12, $monthTo));

        if ($monthFrom === $monthTo) {
            return $this->dailySalesSummary($year, $monthFrom);
        }

        $start = Carbon::create($year, $monthFrom, 1)->startOfDay();
        $end = Carbon::create($year, $monthTo, 1)->endOfMonth()->endOfDay();
        $rows = [];

        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $key = $cursor->toDateString();
            $rows[$key] = [
                'date' => $key,
                'day' => (int) $cursor->day,
                'ecommerce_orders' => 0,
                'booking_count' => 0,
                'ecommerce_sales' => 0.0,
                'booking_sales' => 0.0,
                'refund' => 0.0,
                'total_sales' => 0.0,
            ];
            $cursor->addDay();
        }

        $bucketExpression = 'DATE(' . $this->orderBillAtSql() . ')';
        $refundBucketExpression = 'DATE(COALESCE(processed_at, created_at))';

        foreach ($this->ecommerceSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['ecommerce_orders'] = (int) $row->ecommerce_orders;
            $rows[$key]['ecommerce_sales'] = round((float) $row->ecommerce_sales, 2);
        }

        foreach ($this->bookingSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['booking_count'] = (int) $row->booking_count;
            $rows[$key]['booking_sales'] = round((float) $row->booking_sales, 2);
        }

        foreach ($this->refundSummaryRows($start, $end, $refundBucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['refund'] = round((float) $row->refund, 2);
        }

        $payload = $this->salesSummaryPayload($year, $monthFrom, array_values($rows));
        $payload['month_from'] = $monthFrom;
        $payload['month_to'] = $monthTo;

        return $payload;
    }

    private function monthlySalesSummary(int $year): array
    {
        $start = Carbon::create($year, 1, 1)->startOfDay();
        $end = $start->copy()->endOfYear()->endOfDay();
        $rows = [];

        for ($month = 1; $month <= 12; $month++) {
            $monthStart = Carbon::create($year, $month, 1);
            $rows[$month] = [
                'month' => $month,
                'month_name' => $monthStart->format('M'),
                'ecommerce_orders' => 0,
                'booking_count' => 0,
                'ecommerce_sales' => 0.0,
                'booking_sales' => 0.0,
                'refund' => 0.0,
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'EXTRACT(MONTH FROM ' . $this->orderBillAtSql() . ')::int';
        $refundBucketExpression = 'EXTRACT(MONTH FROM COALESCE(processed_at, created_at))::int';

        foreach ($this->ecommerceSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['ecommerce_orders'] = (int) $row->ecommerce_orders;
            $rows[$key]['ecommerce_sales'] = round((float) $row->ecommerce_sales, 2);
        }

        foreach ($this->bookingSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['booking_count'] = (int) $row->booking_count;
            $rows[$key]['booking_sales'] = round((float) $row->booking_sales, 2);
        }

        foreach ($this->refundSummaryRows($start, $end, $refundBucketExpression) as $row) {
            $key = (int) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['refund'] = round((float) $row->refund, 2);
        }

        return $this->salesSummaryPayload($year, null, array_values($rows));
    }

    private function dailySalesSummary(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth()->endOfDay();
        $rows = [];

        for ($day = 1; $day <= $start->daysInMonth; $day++) {
            $date = Carbon::create($year, $month, $day);
            $key = $date->toDateString();
            $rows[$key] = [
                'date' => $key,
                'day' => $day,
                'ecommerce_orders' => 0,
                'booking_count' => 0,
                'ecommerce_sales' => 0.0,
                'booking_sales' => 0.0,
                'refund' => 0.0,
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'DATE(' . $this->orderBillAtSql() . ')';
        $refundBucketExpression = 'DATE(COALESCE(processed_at, created_at))';

        foreach ($this->ecommerceSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['ecommerce_orders'] = (int) $row->ecommerce_orders;
            $rows[$key]['ecommerce_sales'] = round((float) $row->ecommerce_sales, 2);
        }

        foreach ($this->bookingSummaryRows($start, $end, $bucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['booking_count'] = (int) $row->booking_count;
            $rows[$key]['booking_sales'] = round((float) $row->booking_sales, 2);
        }

        foreach ($this->refundSummaryRows($start, $end, $refundBucketExpression) as $row) {
            $key = (string) $row->bucket;
            if (! isset($rows[$key])) {
                continue;
            }
            $rows[$key]['refund'] = round((float) $row->refund, 2);
        }

        $payload = $this->salesSummaryPayload($year, $month, array_values($rows));
        $payload['month_from'] = $month;
        $payload['month_to'] = $month;

        return $payload;
    }

    /**
     * Historical product cost snapshots for the same ecommerce-sale scope as salesSummary().
     *
     * @return array<int, float> keyed by calendar month
     */
    public function ecommerceCostingByMonth(int $year): array
    {
        $start = Carbon::create($year, 1, 1)->startOfDay();
        $end = $start->copy()->endOfYear()->endOfDay();
        $bucketExpression = 'EXTRACT(MONTH FROM ' . $this->orderBillAtSql() . ')::int';

        return $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'product')
            ->selectRaw("{$bucketExpression} as month")
            ->selectRaw('COALESCE(SUM(COALESCE(oi.cost_amount_snapshot, 0)), 0) as ecommerce_costing')
            ->groupByRaw($bucketExpression)
            ->pluck('ecommerce_costing', 'month')
            ->map(fn ($amount) => round((float) $amount, 2))
            ->all();
    }

    private function ecommerceSummaryRows(Carbon $start, Carbon $end, string $bucketExpression)
    {
        $lineTotal = $this->lineNetAmountSql('oi');

        return $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'product')
            ->selectRaw("{$bucketExpression} as bucket")
            ->selectRaw('COUNT(DISTINCT o.id) as ecommerce_orders')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as ecommerce_sales")
            ->groupByRaw($bucketExpression)
            ->get();
    }

    private function bookingSummaryRows(Carbon $start, Carbon $end, string $bucketExpression)
    {
        $lineTotal = $this->lineNetAmountSql('oi');

        return $this->applyOrderScope(
            ReportBranchScope::applyCurrent(DB::table('orders as o'), 'o.store_location_id')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw("{$bucketExpression} as bucket")
            ->selectRaw(
                "COUNT(DISTINCT CASE WHEN oi.booking_id IS NOT NULL THEN CONCAT('booking:', oi.booking_id::text) " .
                "ELSE CONCAT('order_item:', oi.id::text) END) as booking_count"
            )
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as booking_sales")
            ->groupByRaw($bucketExpression)
            ->get();
    }

    /**
     * Completed refunds for the period (excludes VOID REFUND), bucketed like sales rows.
     */
    private function refundSummaryRows(Carbon $start, Carbon $end, string $bucketExpression)
    {
        return DB::table('booking_refunds')
            ->where('status', 'completed')
            ->whereRaw("COALESCE(reason, '') <> ?", [\App\Services\Ecommerce\VoidRefundService::REASON])
            ->whereBetween(DB::raw('COALESCE(processed_at, created_at)'), [$start, $end])
            ->selectRaw("{$bucketExpression} as bucket")
            ->selectRaw('COALESCE(SUM(amount), 0) as refund')
            ->groupByRaw($bucketExpression)
            ->get();
    }

    private function salesSummaryPayload(int $year, ?int $month, array $rows): array
    {
        $rows = array_map(function (array $row) {
            $row['ecommerce_sales'] = round((float) ($row['ecommerce_sales'] ?? 0), 2);
            $row['booking_sales'] = round((float) ($row['booking_sales'] ?? 0), 2);
            $row['refund'] = round((float) ($row['refund'] ?? 0), 2);
            $row['booking_count'] = (int) ($row['booking_count'] ?? 0);
            $row['total_sales'] = round($row['ecommerce_sales'] + $row['booking_sales'] - $row['refund'], 2);
            $row['ecommerce_orders'] = (int) ($row['ecommerce_orders'] ?? 0);

            return $row;
        }, $rows);

        return [
            'year' => $year,
            'month' => $month,
            'mode' => $month === null ? 'monthly' : 'daily',
            'summary' => [
                'ecommerce_sales' => round(array_sum(array_column($rows, 'ecommerce_sales')), 2),
                'booking_sales' => round(array_sum(array_column($rows, 'booking_sales')), 2),
                'refund' => round(array_sum(array_column($rows, 'refund')), 2),
                'total_sales' => round(array_sum(array_column($rows, 'total_sales')), 2),
                'total_orders' =>
                    (int) array_sum(array_column($rows, 'ecommerce_orders')) +
                    (int) array_sum(array_column($rows, 'booking_count')),
            ],
            'rows' => $rows,
        ];
    }

    public function ecommerceDay(Carbon $day): array
    {
        $payload = $this->ecommercePeriod($day->copy()->startOfDay(), $day->copy()->endOfDay());
        $payload['date'] = $day->toDateString();

        return $payload;
    }

    public function ecommercePeriod(Carbon $start, Carbon $end): array
    {
        $paymentBlock = $this->paymentMethodsForWorkspace(WorkspaceType::ECOMMERCE, $start, $end);

        $lineTotal = $this->lineNetAmountSql('oi');

        $itemAgg = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', ['product', 'service', 'service_package'])
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'product' THEN $lineTotal ELSE 0 END), 0) as product")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service' THEN $lineTotal ELSE 0 END), 0) as service")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service_package' THEN $lineTotal ELSE 0 END), 0) as multi_package")
            ->first();

        $channelSplit = (object) [
            'online' => $paymentBlock['totals']['online'],
            'offline' => $paymentBlock['totals']['offline'],
        ];

        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $roster = $this->salesReportStaffRoster();
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
        [$staffSales, $staffService] = $this->attachStaffBranchBreakdowns($staffSales, $staffService, $start, $end);
        $packageRedemption = $this->packageRedemptionValue($start, $end);

        return [
            'date_from' => $start->toDateString(),
            'date_to' => $end->toDateString(),
            'online_offline' => [
                'online' => round((float) ($channelSplit->online ?? 0), 2),
                'offline' => round((float) ($channelSplit->offline ?? 0), 2),
            ],
            'payment_methods' => $paymentBlock['rows'],
            'refunds' => $this->refundRows($start, $end),
            'item_types' => [
                'estimate' => true,
                'product' => round((float) ($itemAgg->product ?? 0), 2),
                'service' => round((float) ($itemAgg->service ?? 0), 2),
                'multi_package' => round((float) ($itemAgg->multi_package ?? 0), 2),
                'package_redemption' => $packageRedemption,
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => 0.0,
                'message' => 'N/A for ecommerce catalog. Use Booking workspace for booking settlement totals.',
            ],
            'staff' => [
                'branch_context' => ReportBranchScope::current()->selectedStoreLocationId === null,
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
                'service_activity_amount_total' => round(array_sum(array_column($staffService, 'service_amount')), 2),
            ],
        ];
    }

    public function bookingDay(Carbon $day): array
    {
        $payload = $this->bookingPeriod($day->copy()->startOfDay(), $day->copy()->endOfDay());
        $payload['date'] = $day->toDateString();

        return $payload;
    }

    public function bookingPeriod(Carbon $start, Carbon $end): array
    {
        $paymentBlock = $this->paymentMethodsForWorkspace(WorkspaceType::BOOKING, $start, $end);

        $lineTotal = $this->lineNetAmountSql('oi');

        $bookingPackageSub = $this->applyOrderScope(
            ReportBranchScope::applyCurrent(DB::table('orders as o'), 'o.store_location_id')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'service_package')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as multi_package")
            ->first();

        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $roster = $this->salesReportStaffRoster();
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
        [$staffSales, $staffService] = $this->attachStaffBranchBreakdowns($staffSales, $staffService, $start, $end);
        $packageRedemption = $this->packageRedemptionValue($start, $end);

        $serviceConsumedQuery = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'booking_settlement')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as v");

        return [
            'date_from' => $start->toDateString(),
            'date_to' => $end->toDateString(),
            'online_offline' => [
                'online' => $paymentBlock['totals']['online'],
                'offline' => $paymentBlock['totals']['offline'],
            ],
            'payment_methods' => $paymentBlock['rows'],
            'refunds' => $this->refundRows($start, $end),
            'item_types' => [
                'estimate' => true,
                'product' => 0.0,
                'service' => $this->bookingServiceItemTypeAmount($start, $end),
                'multi_package' => round((float) ($bookingPackageSub->multi_package ?? 0), 2),
                'package_redemption' => $packageRedemption,
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => round((float) $serviceConsumedQuery->value('v'), 2),
                'message' => 'Final settlement lines for booking orders in this period.',
            ],
            'staff' => [
                'branch_context' => ReportBranchScope::current()->selectedStoreLocationId === null,
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
                'service_activity_amount_total' => round(array_sum(array_column($staffService, 'service_amount')), 2),
            ],
        ];
    }

    public function allDay(Carbon $day): array
    {
        $payload = $this->allPeriod($day->copy()->startOfDay(), $day->copy()->endOfDay());
        $payload['date'] = $day->toDateString();

        return $payload;
    }

    /**
     * Staff-scoped sales summary for the logged-in staff member (ecommerce products + booking services).
     */
    public function staffSalesSummary(Carbon $start, Carbon $end, int $staffId): array
    {
        $lineTotal = $this->lineNetAmountSql('oi');
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));

        $staff = DB::table('staffs')->where('id', $staffId)->first();
        $staffName = $staff ? (string) $staff->name : 'Staff #'.$staffId;

        $productSales = round((float) ($ecKeyed[$staffId]['product_sales'] ?? $ecKeyed[$staffId]['total'] ?? 0), 2);
        $serviceAmount = round((float) ($svcKeyed[$staffId]['service_amount'] ?? $svcKeyed[$staffId]['total'] ?? 0), 2);
        $serviceCount = (int) ($svcKeyed[$staffId]['service_count'] ?? 0);

        return [
            'range' => [
                'date_from' => $start->toDateString(),
                'date_to' => $end->toDateString(),
            ],
            'staff' => [
                'staff_id' => $staffId,
                'name' => $staffName,
                'product_sales' => $productSales,
                'service_amount' => $serviceAmount,
                'service_count' => $serviceCount,
            ],
        ];
    }

    /**
     * Mixed workspace aggregates for a date range (month, year, or custom).
     */
    public function allPeriod(Carbon $start, Carbon $end): array
    {
        $paymentBlock = $this->paymentMethodsForAllWorkspace($start, $end);
        $lineTotal = $this->lineNetAmountSql('oi');

        // One aggregate for product/service/package (same split as before; avoids a second scan).
        $itemAgg = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', ['product', 'service', 'service_package'])
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'product' THEN $lineTotal ELSE 0 END), 0) as product")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service' THEN $lineTotal ELSE 0 END), 0) as service")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service_package' THEN $lineTotal ELSE 0 END), 0) as multi_package")
            ->first();

        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $roster = $this->salesReportStaffRoster();
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
        [$staffSales, $staffService] = $this->attachStaffBranchBreakdowns($staffSales, $staffService, $start, $end);
        $packageRedemption = $this->packageRedemptionValue($start, $end);

        $serviceConsumedAmount = round((float) $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'booking_settlement')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as v")
            ->value('v'), 2);

        return [
            'online_offline' => [
                'online' => $paymentBlock['totals']['online'],
                'offline' => $paymentBlock['totals']['offline'],
            ],
            'payment_methods' => $paymentBlock['rows'],
            'refunds' => $this->refundRows($start, $end),
            'item_types' => [
                'estimate' => true,
                'product' => round((float) ($itemAgg->product ?? 0), 2),
                'service' => round((float) ($itemAgg->service ?? 0) + $this->bookingServiceItemTypeAmount($start, $end), 2),
                'multi_package' => round((float) ($itemAgg->multi_package ?? 0), 2),
                'package_redemption' => $packageRedemption,
                'unlimited_plan' => 0.0,
                'other' => 0.0,
            ],
            'points_redemption' => [
                'product' => null,
                'service' => null,
                'message' => 'Point redemption detail is not wired for this view yet.',
            ],
            'service_consumed' => [
                'amount' => $serviceConsumedAmount,
                'message' => 'Final settlement lines for booking orders in this period.',
            ],
            'staff' => [
                'branch_context' => ReportBranchScope::current()->selectedStoreLocationId === null,
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
                'service_activity_amount_total' => round(array_sum(array_column($staffService, 'service_amount')), 2),
            ],
        ];
    }

    /**
     * Add earning-Branch context for All Branches with two grouped queries (never
     * one query per Staff/Branch). Specific-Branch responses remain compact.
     */
    private function attachStaffBranchBreakdowns(array $sales, array $services, Carbon $start, Carbon $end): array
    {
        if (ReportBranchScope::current()->selectedStoreLocationId !== null) {
            return [$sales, $services];
        }

        $productSplit = StaffSplitNormalizer::splitSalesSql('splits', $this->lineNetAmountSql('oi'));
        $productRows = $this->applyOrderScope(DB::table('order_item_staff_splits as splits')
            ->join('order_items as oi', 'oi.id', '=', 'splits.order_item_id')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->leftJoin('store_locations as branch', 'branch.id', '=', 'o.store_location_id')
            ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
            ->where('oi.line_type', 'product'))
            ->groupBy('splits.staff_id', 'o.store_location_id', 'branch.name', 'branch.code')
            ->selectRaw('splits.staff_id, o.store_location_id, branch.name as branch_name, branch.code as branch_code')
            ->selectRaw("COALESCE(SUM({$productSplit}), 0) as amount")
            ->get();

        $serviceSplit = StaffSplitNormalizer::splitSalesSql('order_item_staff_splits', $this->effectiveBookingLineTotalExpr());
        $serviceRows = $this->applyOrderScope(DB::table('order_item_staff_splits')
            ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('store_locations as branch', 'branch.id', '=', 'orders.store_location_id')
            ->whereBetween(DB::raw($this->orderBillAtSql('orders')), [$start, $end])
            ->whereIn('order_items.line_type', self::BOOKING_LINE_TYPES), 'orders')
            ->groupBy('order_item_staff_splits.staff_id', 'orders.store_location_id', 'branch.name', 'branch.code')
            ->selectRaw('order_item_staff_splits.staff_id, orders.store_location_id, branch.name as branch_name, branch.code as branch_code')
            ->selectRaw("COALESCE(SUM({$serviceSplit}), 0) as amount")
            ->get();

        $format = fn ($rows) => $rows->groupBy('staff_id')->map(fn ($staffRows) => $staffRows->map(fn ($row) => [
            'store_location_id' => $row->store_location_id === null ? null : (int) $row->store_location_id,
            'branch_name' => $row->store_location_id === null ? 'Unassigned' : (string) $row->branch_name,
            'branch_code' => $row->store_location_id === null ? null : (string) $row->branch_code,
            'amount' => round((float) $row->amount, 2),
        ])->values()->all());
        $productByStaff = $format($productRows);
        $serviceByStaff = $format($serviceRows);

        $sales = array_map(fn ($row) => [...$row, 'branch_breakdown' => $productByStaff->get($row['staff_id'], [])], $sales);
        $services = array_map(fn ($row) => [...$row, 'branch_breakdown' => $serviceByStaff->get($row['staff_id'], [])], $services);

        return [$sales, $services];
    }

    /**
     * Item type "Service" for booking lines — same settlement-day rule as Staff service sales:
     * deposit is not counted on pay day; once a booking settles in this period, deposit +
     * settlement + addon are attributed together. Booking products still count by bill date.
     */
    private function bookingServiceItemTypeAmount(Carbon $start, Carbon $end): float
    {
        $lineTotal = $this->lineNetAmountSql('oi');
        $settledBookingIds = $this->settledBookingIdsInRange($start, $end);

        $settledAmount = 0.0;
        if ($settledBookingIds !== []) {
            $packageClaimBookingIds = $this->bookingIdsWithPackageClaimRedemption($settledBookingIds);
            $settledQuery = $this->applyOrderScope(
                DB::table('order_items as oi')
                    ->join('orders as o', 'o.id', '=', 'oi.order_id')
                    ->whereIn('oi.booking_id', $settledBookingIds)
                    ->whereIn('oi.line_type', self::BOOKING_STAFF_SALES_LINE_TYPES)
            );
            $this->excludePackageRefundedBookingDeposits($settledQuery, 'oi', $packageClaimBookingIds);
            $settledAmount = (float) $settledQuery
                ->selectRaw("COALESCE(SUM($lineTotal), 0) as v")
                ->value('v');
        }

        $bookingProductAmount = (float) $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
                ->where('oi.line_type', 'booking_product')
        )
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as v")
            ->value('v');

        return round($settledAmount + $bookingProductAmount, 2);
    }

    private function packageRedemptionValue(Carbon $start, Carbon $end): float
    {
        // Only candidate zero-net / positive-gross settlement|addon lines can contribute;
        // prefilter so the correlated usage lookup is not evaluated on every booking line.
        $netExpr = "COALESCE(oi.line_total_after_discount, oi.effective_line_total, oi.line_total, 0)::numeric";
        $grossExpr = "COALESCE(oi.line_total_snapshot, oi.line_total, 0)::numeric";
        $redemptionExpr = $this->packageRedemptionLineValueExpr('oi');

        return round((float) $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end]),
            'o'
        )
            ->whereIn('oi.line_type', ['booking_settlement', 'booking_addon'])
            ->whereNotNull('oi.booking_id')
            ->whereNotNull('oi.booking_service_id')
            ->whereRaw("{$netExpr} <= 0.0001")
            ->whereRaw("{$grossExpr} > 0.0001")
            ->selectRaw("COALESCE(SUM({$redemptionExpr}), 0) as v")
            ->value('v'), 2);
    }

    private function packageRedemptionLineValueExpr(string $orderItemAlias = 'order_items'): string
    {
        $netExpr = "COALESCE($orderItemAlias.line_total_after_discount, $orderItemAlias.effective_line_total, $orderItemAlias.line_total, 0)::numeric";
        $grossExpr = "COALESCE($orderItemAlias.line_total_snapshot, $orderItemAlias.line_total, 0)::numeric";

        return "(CASE WHEN $orderItemAlias.line_type IN ('booking_settlement','booking_addon') AND $orderItemAlias.booking_id IS NOT NULL AND $orderItemAlias.booking_service_id IS NOT NULL AND $netExpr <= 0.0001 AND $grossExpr > 0.0001 THEN COALESCE((SELECT COALESCE(spi.redemption_value, 0)::numeric * GREATEST(1, COALESCE($orderItemAlias.quantity, 1))::numeric FROM customer_service_package_usages u JOIN customer_service_packages csp ON csp.id = u.customer_service_package_id JOIN service_package_items spi ON spi.service_package_id = csp.service_package_id AND spi.booking_service_id = u.booking_service_id WHERE u.booking_service_id = $orderItemAlias.booking_service_id AND u.status IN ('reserved','consumed') AND (u.booking_id = $orderItemAlias.booking_id OR (u.used_from = 'POS' AND u.used_ref_id = $orderItemAlias.booking_id)) ORDER BY u.id LIMIT 1), 0) ELSE 0 END)::numeric";
    }

    /**
     * A deposit is returned when the service is ultimately paid by a package claim.
     * Exclude that old deposit from staff sales; the package redemption value is the
     * commissionable service value for the completed booking.
     *
     * When $packageClaimBookingIds is provided (precomputed), uses a cheap NOT IN
     * instead of a correlated EXISTS with packageRedemptionLineValueExpr per row.
     *
     * @param  list<int>|null  $packageClaimBookingIds
     */
    private function excludePackageRefundedBookingDeposits(
        Builder $query,
        string $orderItemAlias = 'order_items',
        ?array $packageClaimBookingIds = null
    ): Builder {
        if ($packageClaimBookingIds !== null) {
            if ($packageClaimBookingIds === []) {
                return $query;
            }

            return $query->where(function (Builder $scope) use ($orderItemAlias, $packageClaimBookingIds) {
                $scope->where("{$orderItemAlias}.line_type", '!=', 'booking_deposit')
                    ->orWhereNotIn("{$orderItemAlias}.booking_id", $packageClaimBookingIds);
            });
        }

        $packageValue = $this->packageRedemptionLineValueExpr('package_claim_item');

        return $query->where(function (Builder $scope) use ($orderItemAlias, $packageValue) {
            $scope->where("{$orderItemAlias}.line_type", '!=', 'booking_deposit')
                ->orWhereNotExists(function (Builder $packageClaim) use ($orderItemAlias, $packageValue) {
                    $packageClaim->selectRaw('1')
                        ->from('order_items as package_claim_item')
                        ->whereColumn('package_claim_item.booking_id', "{$orderItemAlias}.booking_id")
                        ->whereRaw("($packageValue) > 0.0001");
                });
        });
    }

    /**
     * Settled booking IDs in range (request-memoized — staff + item-type paths share this).
     *
     * @return list<int>
     */
    private function settledBookingIdsInRange(Carbon $start, Carbon $end): array
    {
        $scope = ReportBranchScope::current();
        $cacheKey = implode(':', [
            'sales_visual_settled_bookings',
            $start->timestamp,
            $end->timestamp,
            $this->includeVoidOrders ? '1' : '0',
            $scope->selectedStoreLocationId ?? 'all',
            implode(',', $scope->storeLocationIds),
        ]);
        $cached = request()->attributes->get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $ids = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->where('oi.line_type', 'booking_settlement')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
                ->whereNotNull('oi.booking_id')
        )
            ->pluck('oi.booking_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        request()->attributes->set($cacheKey, $ids);

        return $ids;
    }

    /**
     * Booking IDs that have at least one package-claim line with redemption value > 0
     * (same min-usage-id rule as packageRedemptionLineValueExpr).
     *
     * @param  list<int>  $bookingIds
     * @return list<int>
     */
    private function bookingIdsWithPackageClaimRedemption(array $bookingIds): array
    {
        if ($bookingIds === []) {
            return [];
        }

        $sorted = $bookingIds;
        sort($sorted);
        $cacheKey = 'sales_visual_pkg_claim_'.md5(implode(',', $sorted));
        $cached = request()->attributes->get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $netExpr = "COALESCE(oi.line_total_after_discount, oi.effective_line_total, oi.line_total, 0)::numeric";
        $grossExpr = "COALESCE(oi.line_total_snapshot, oi.line_total, 0)::numeric";
        $redemptionScalar = $this->packageRedemptionLineValueExpr('oi');

        $ids = DB::table('order_items as oi')
            ->whereIn('oi.booking_id', $bookingIds)
            ->whereIn('oi.line_type', ['booking_settlement', 'booking_addon'])
            ->whereNotNull('oi.booking_service_id')
            ->whereRaw("{$netExpr} <= 0.0001")
            ->whereRaw("{$grossExpr} > 0.0001")
            ->whereRaw("({$redemptionScalar}) > 0.0001")
            ->distinct()
            ->pluck('oi.booking_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        request()->attributes->set($cacheKey, $ids);

        return $ids;
    }

    /**
     * Staff cards list Staffs-page profiles only (`staffs`), never Admins / Staff-role logins.
     * A row appears when show_in_sales_report is on and the staff is assigned to the current Branch.
     *
     * @return list<array{staff_id: int, name: string}>
     */
    private function salesReportStaffRoster(): array
    {
        $scope = ReportBranchScope::current();
        $cacheKey = 'sales_visual_staff_roster_'.($scope->selectedStoreLocationId ?? 'all').'_'.implode(',', $scope->storeLocationIds);
        $cached = request()->attributes->get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $roster = DB::table('staffs as st')
            ->where('st.show_in_sales_report', true)
            ->whereExists(function (Builder $assignment) use ($scope) {
                $assignment->selectRaw('1')
                    ->from('staff_store_location as ssl')
                    ->whereColumn('ssl.staff_id', 'st.id')
                    ->whereIn('ssl.store_location_id', $scope->storeLocationIds);
            })
            ->orderBy('st.name')
            ->select('st.id', 'st.name')
            ->get()
            ->map(fn ($r) => [
                'staff_id' => (int) $r->id,
                'name' => (string) $r->name,
            ])
            ->values()
            ->all();

        request()->attributes->set($cacheKey, $roster);

        return $roster;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function keyRowsByStaffId(array $rows): array
    {
        $by = [];
        foreach ($rows as $r) {
            $id = (int) ($r['staff_id'] ?? 0);
            if ($id > 0) {
                $by[$id] = $r;
            }
        }

        return $by;
    }

    /**
     * @param  list<array{staff_id: int, name: string}>  $roster
     * @param  array<int, array<string, mixed>>  $byId  keyed by staff_id from ecommerceStaffProductSales
     * @return list<array{staff_id: int, name: string, product_sales: float, total: float}>
     */
    private function padStaffWithEcommerceProductSales(array $roster, array $byId): array
    {
        $out = [];
        foreach ($roster as $s) {
            $id = $s['staff_id'];
            $amt = isset($byId[$id]) ? (float) ($byId[$id]['product_sales'] ?? $byId[$id]['total'] ?? 0) : 0.0;
            $out[] = [
                'staff_id' => $id,
                'name' => $s['name'],
                'product_sales' => round($amt, 2),
                'total' => round($amt, 2),
            ];
        }

        return $out;
    }

    /**
     * @param  list<array{staff_id: int, name: string}>  $roster
     * @param  array<int, array<string, mixed>>  $byId  keyed by staff_id from completedBookingServiceActivityByStaff
     * @return list<array{staff_id: int, name: string, service_count: int, service_amount: float, total: float}>
     */
    private function padStaffWithServiceActivity(array $roster, array $byId): array
    {
        $out = [];
        foreach ($roster as $s) {
            $id = $s['staff_id'];
            $cnt = isset($byId[$id]) ? (int) ($byId[$id]['service_count'] ?? 0) : 0;
            $amt = isset($byId[$id]) ? (float) ($byId[$id]['service_amount'] ?? $byId[$id]['total'] ?? 0) : 0.0;
            $out[] = [
                'staff_id' => $id,
                'name' => $s['name'],
                'service_count' => $cnt,
                'service_amount' => round($amt, 2),
                'total' => round($amt, 2),
            ];
        }

        return $out;
    }

    private function ecommerceStaffProductSales(Carbon $start, Carbon $end, string $lineTotal): array
    {
        $splitSalesSql = StaffSplitNormalizer::splitSalesSql('sps', $lineTotal);
        $productRows = $this->applyOrderScope(
            DB::table('order_item_staff_splits as sps')
                ->join('order_items as oi', 'oi.id', '=', 'sps.order_item_id')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->join('staffs as st', 'st.id', '=', 'sps.staff_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'product')
            ->groupBy('st.id', 'st.name')
            ->selectRaw('st.id as staff_id')
            ->selectRaw('st.name as staff_name')
            ->selectRaw("COALESCE(SUM({$splitSalesSql}), 0) as product_sales")
            ->get();

        $packageRows = $this->applyOrderScope(
            DB::table('service_package_staff_splits as sps')
                ->join('orders as o', 'o.id', '=', 'sps.order_id')
                ->join('staffs as st', 'st.id', '=', 'sps.staff_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->groupBy('st.id', 'st.name')
            ->selectRaw('st.id as staff_id')
            ->selectRaw('st.name as staff_name')
            ->selectRaw('COALESCE(SUM(sps.split_sales_amount), 0) as product_sales')
            ->get();

        $byStaff = [];
        foreach ($productRows->concat($packageRows) as $row) {
            $staffId = (int) ($row->staff_id ?? 0);
            if ($staffId <= 0) {
                continue;
            }
            $byStaff[$staffId] = [
                'staff_id' => $staffId,
                'staff_name' => (string) ($row->staff_name ?? ('Staff #' . $staffId)),
                'product_sales' => round((float) ($byStaff[$staffId]['product_sales'] ?? 0) + (float) ($row->product_sales ?? 0), 2),
            ];
        }

        return collect($byStaff)
            ->sortByDesc('product_sales')
            ->values()
            ->map(fn (array $row) => [
                'staff_id' => $row['staff_id'],
                'name' => $row['staff_name'],
                'product_sales' => $row['product_sales'],
                'total' => $row['product_sales'],
            ])
            ->all();
    }


    /**
     * Calculate staff commission sales for bookings.
     *
     * IMPORTANT: Booking sales (deposit, settlement, addon) are only counted AFTER settlement.
     * When a booking is settled within the date range, ALL amounts for that booking (including
     * the deposit paid earlier) are counted together on the settlement date.
     *
     * This ensures:
     * 1. Creating an appointment / paying deposit does NOT immediately count towards staff sales
     * 2. Only after settlement, the full amount (deposit + settlement + addons) is attributed
     * 3. Service count is per unique booking, not per order_item
     *
     * Booking products are handled separately - they count when the order is paid.
     */
    private function bookingStaffCommissionSales(Carbon $start, Carbon $end): array
    {
        // Step 1: Find all bookings that were SETTLED within the date range
        // A booking is considered "settled" when it has a booking_settlement order_item in a valid paid order
        $settledBookingIds = $this->settledBookingIdsInRange($start, $end);

        $byStaff = [];
        $countedBookingsByStaff = [];

        if (! empty($settledBookingIds)) {
            $packageClaimBookingIds = $this->bookingIdsWithPackageClaimRedemption($settledBookingIds);

            // Step 2a: Get amounts from order_item_staff_splits (POS deposits and all settlements)
            $bookingSplitSalesSql = StaffSplitNormalizer::splitSalesSql(
                'order_item_staff_splits',
                $this->effectiveBookingLineTotalExpr(),
            );
            $splitRowsQuery = $this->applyOrderScope(
                DB::table('order_item_staff_splits')
                    ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->join('staffs', 'staffs.id', '=', 'order_item_staff_splits.staff_id')
                    ->whereIn('order_items.booking_id', $settledBookingIds)
                    ->whereIn('order_items.line_type', self::BOOKING_STAFF_SALES_LINE_TYPES),
                'orders'
            );
            $this->excludePackageRefundedBookingDeposits($splitRowsQuery, 'order_items', $packageClaimBookingIds);
            $splitRows = $splitRowsQuery
                ->selectRaw('staffs.id as staff_id')
                ->selectRaw('staffs.name as staff_name')
                ->selectRaw('order_items.booking_id as booking_id')
                ->selectRaw('order_items.id as order_item_id')
                ->selectRaw("({$bookingSplitSalesSql}) as split_amount")
                ->get();

            $orderItemsWithSplits = [];
            foreach ($splitRows as $row) {
                $staffId = (int) $row->staff_id;
                $bookingId = (int) $row->booking_id;
                $orderItemId = (int) $row->order_item_id;

                $orderItemsWithSplits[$orderItemId] = true;

                if (! isset($byStaff[$staffId])) {
                    $byStaff[$staffId] = [
                        'staff_id' => $staffId,
                        'name' => (string) $row->staff_name,
                        'service_count' => 0,
                        'service_amount' => 0.0,
                    ];
                    $countedBookingsByStaff[$staffId] = [];
                }

                $byStaff[$staffId]['service_amount'] += (float) $row->split_amount;

                if (! isset($countedBookingsByStaff[$staffId][$bookingId])) {
                    $countedBookingsByStaff[$staffId][$bookingId] = true;
                    $byStaff[$staffId]['service_count']++;
                }
            }

            // Step 2b: Fallback for order_items WITHOUT order_item_staff_splits (e.g., online deposits)
            // These should use booking_service_staff_splits instead
            $lineTotal = 'COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
            $fallbackLineTotal = "GREATEST($lineTotal, " . $this->packageRedemptionLineValueExpr('order_items') . ")";

            $fallbackItemsQuery = $this->applyOrderScope(
                DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->whereIn('order_items.booking_id', $settledBookingIds)
                    ->whereIn('order_items.line_type', self::BOOKING_STAFF_SALES_LINE_TYPES)
                    ->whereNotExists(function ($sub) {
                        $sub->selectRaw('1')
                            ->from('order_item_staff_splits')
                            ->whereColumn('order_item_staff_splits.order_item_id', 'order_items.id');
                    }),
                'orders'
            );
            $this->excludePackageRefundedBookingDeposits($fallbackItemsQuery, 'order_items', $packageClaimBookingIds);
            $fallbackItems = $fallbackItemsQuery
                ->selectRaw('order_items.id as order_item_id')
                ->selectRaw('order_items.booking_id as booking_id')
                ->selectRaw("$fallbackLineTotal as line_amount")
                ->get();

            if ($fallbackItems->isNotEmpty()) {
                $fallbackBookingIds = $fallbackItems->pluck('booking_id')->unique()->values()->all();

                // Get booking_service_staff_splits for these bookings
                $bookingSplits = DB::table('booking_service_staff_splits')
                    ->join('staffs', 'staffs.id', '=', 'booking_service_staff_splits.staff_id')
                    ->whereIn('booking_service_staff_splits.booking_id', $fallbackBookingIds)
                    ->get(['booking_service_staff_splits.booking_id', 'booking_service_staff_splits.staff_id', 'booking_service_staff_splits.split_percent', 'booking_service_staff_splits.share_amount', 'staffs.name as staff_name'])
                    ->groupBy('booking_id');

                // Fallback to bookings.staff_id if no booking_service_staff_splits exist
                $bookingStaffFallback = ReportBranchScope::applyCurrent(DB::table('bookings'), 'bookings.store_location_id')
                    ->join('staffs', 'staffs.id', '=', 'bookings.staff_id')
                    ->whereIn('bookings.id', $fallbackBookingIds)
                    ->whereNotNull('bookings.staff_id')
                    ->get(['bookings.id as booking_id', 'bookings.staff_id', 'staffs.name as staff_name'])
                    ->keyBy('booking_id');

                foreach ($fallbackItems as $item) {
                    $bookingId = (int) $item->booking_id;
                    $lineAmount = (float) $item->line_amount;

                    $splits = $bookingSplits->get($bookingId);
                    if ($splits && $splits->isNotEmpty()) {
                        foreach ($splits as $split) {
                            $staffId = (int) $split->staff_id;
                            $shareAmount = (float) ($split->share_amount ?? 0);
                            $sharePercent = (float) $split->split_percent;
                            $splitAmount = $shareAmount > 0
                                ? $shareAmount
                                : $lineAmount * ($sharePercent / 100);

                            if (! isset($byStaff[$staffId])) {
                                $byStaff[$staffId] = [
                                    'staff_id' => $staffId,
                                    'name' => (string) $split->staff_name,
                                    'service_count' => 0,
                                    'service_amount' => 0.0,
                                ];
                                $countedBookingsByStaff[$staffId] = [];
                            }

                            $byStaff[$staffId]['service_amount'] += $splitAmount;

                            if (! isset($countedBookingsByStaff[$staffId][$bookingId])) {
                                $countedBookingsByStaff[$staffId][$bookingId] = true;
                                $byStaff[$staffId]['service_count']++;
                            }
                        }
                    } elseif (isset($bookingStaffFallback[$bookingId])) {
                        // Use booking's primary staff as fallback
                        $fallbackStaff = $bookingStaffFallback[$bookingId];
                        $staffId = (int) $fallbackStaff->staff_id;

                        if (! isset($byStaff[$staffId])) {
                            $byStaff[$staffId] = [
                                'staff_id' => $staffId,
                                'name' => (string) $fallbackStaff->staff_name,
                                'service_count' => 0,
                                'service_amount' => 0.0,
                            ];
                            $countedBookingsByStaff[$staffId] = [];
                        }

                        $byStaff[$staffId]['service_amount'] += $lineAmount;

                        if (! isset($countedBookingsByStaff[$staffId][$bookingId])) {
                            $countedBookingsByStaff[$staffId][$bookingId] = true;
                            $byStaff[$staffId]['service_count']++;
                        }
                    }
                }
            }
        }

        // Step 3: Add booking_product counts (these count when their order is paid, not tied to settlement)
        $bookingProductSplitSalesSql = StaffSplitNormalizer::splitSalesSql(
            'order_item_staff_splits',
            $this->effectiveBookingLineTotalExpr(),
        );
        $productRows = $this->applyOrderScope(
            DB::table('order_item_staff_splits')
                ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('staffs', 'staffs.id', '=', 'order_item_staff_splits.staff_id')
                ->whereBetween(DB::raw($this->orderBillAtSql('orders')), [$start, $end])
                ->where('order_items.line_type', 'booking_product'),
            'orders'
        )
            ->groupBy('staffs.id', 'staffs.name')
            ->selectRaw('staffs.id as staff_id')
            ->selectRaw('staffs.name as staff_name')
            ->selectRaw('COUNT(DISTINCT order_items.id) as product_count')
            ->selectRaw("COALESCE(SUM({$bookingProductSplitSalesSql}), 0) as product_amount")
            ->get();

        foreach ($productRows as $row) {
            $staffId = (int) $row->staff_id;
            if (! isset($byStaff[$staffId])) {
                $byStaff[$staffId] = [
                    'staff_id' => $staffId,
                    'name' => (string) $row->staff_name,
                    'service_count' => 0,
                    'service_amount' => 0.0,
                ];
            }
            $byStaff[$staffId]['service_count'] += (int) $row->product_count;
            $byStaff[$staffId]['service_amount'] += (float) $row->product_amount;
        }

        // Return sorted by service_amount descending
        return collect($byStaff)
            ->map(fn (array $row) => [
                'staff_id' => (int) $row['staff_id'],
                'name' => (string) $row['name'],
                'service_count' => (int) $row['service_count'],
                'service_amount' => round((float) $row['service_amount'], 2),
                'total' => round((float) $row['service_amount'], 2),
            ])
            ->sortByDesc('service_amount')
            ->values()
            ->all();
    }

    /**
     * Base query for booking order item splits.
     * Used by other methods that need all booking line types within a date range.
     */
    private function baseBookingOrderItemSplitQuery(Carbon $start, Carbon $end): Builder
    {
        return $this->applyOrderScope(
            ReportBranchScope::applyCurrent(DB::table('orders'), 'orders.store_location_id')
                ->join('order_items', 'order_items.order_id', '=', 'orders.id')
                ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
                ->whereBetween(DB::raw($this->orderBillAtSql('orders')), [$start, $end]),
            'orders'
        )
            ->whereIn('order_items.line_type', ['booking_settlement', 'booking_addon', 'booking_product']);
    }

    /**
     * Matches StaffCommissionService::effectiveLineTotalExpr for booking commissions so the
     * visual report allocates each service/product base/add-on line from its own split source.
     */
    private function effectiveBookingLineTotalExpr(): string
    {
        $lineTotalExpr = 'COALESCE(order_items.line_total_after_discount, order_items.effective_line_total, order_items.line_total)::numeric';
        $optionTotalExpr = "COALESCE((SELECT SUM(COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(order_items.quantity, 1)::numeric, 0)) FROM jsonb_array_elements(COALESCE(order_items.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option)), 0)";
        $matchingOptionExpr = "COALESCE((SELECT COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(order_items.quantity, 1)::numeric, 0) FROM jsonb_array_elements(COALESCE(order_items.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option) WHERE option_row.option->>'id' = order_item_staff_splits.line_ref_id LIMIT 1), order_item_staff_splits.amount_basis)";

        return "(CASE WHEN order_items.line_type = 'booking_product' AND order_item_staff_splits.line_type = 'booking_product_base' THEN GREATEST(0, ($lineTotalExpr) - ($optionTotalExpr)) WHEN order_items.line_type = 'booking_product' AND order_item_staff_splits.line_type = 'booking_product_option' THEN COALESCE($matchingOptionExpr, order_item_staff_splits.amount_basis, $lineTotalExpr) ELSE COALESCE(order_item_staff_splits.amount_basis, $lineTotalExpr) END)::numeric";
    }

    private function lineNetAmountSql(string $alias = 'oi'): string
    {
        return "COALESCE({$alias}.line_total_after_discount, {$alias}.effective_line_total, {$alias}.line_total - COALESCE({$alias}.discount_amount, 0))";
    }

    private function orderNetAmountSubquery(string $workspaceLineFilterSql): string
    {
        $lineNet = $this->lineNetAmountSql('oi_sn');

        return "(SELECT COALESCE(SUM($lineNet), 0) FROM order_items oi_sn WHERE oi_sn.order_id = o.id AND ({$workspaceLineFilterSql}))";
    }

    /**
     * Allocate order net revenue to a payment row by share of recorded payments.
     * Uses SUM(order_payments.amount) as the denominator so cash tender (e.g. RM 5000 on a RM 500
     * order) does not inflate sales; split payments still allocate by their relative shares.
     */
    private function allocatedPaymentNetSql(string $orderNetSql): string
    {
        $paymentsSumSql = '(SELECT COALESCE(SUM(p2.amount), 0) FROM order_payments p2 WHERE p2.order_id = o.id)';

        return "CASE
            WHEN op.id IS NOT NULL AND {$paymentsSumSql} > 0
            THEN (COALESCE(op.amount, 0) / {$paymentsSumSql}) * ({$orderNetSql})
            ELSE ({$orderNetSql})
        END";
    }

    private function ecommerceWorkspaceLineFilterSql(string $alias = 'oi_sn'): string
    {
        return "{$alias}.line_type = 'product'";
    }

    private function bookingWorkspaceLineFilterSql(string $alias = 'oi_sn'): string
    {
        $types = implode("','", self::BOOKING_LINE_TYPES);

        return "{$alias}.line_type IN ('{$types}')";
    }

    private function allWorkspaceLineFilterSql(string $alias = 'oi_sn'): string
    {
        return "({$this->ecommerceWorkspaceLineFilterSql($alias)} OR {$this->bookingWorkspaceLineFilterSql($alias)})";
    }


    private function refundRows(Carbon $start, Carbon $end): array
    {
        $labels = [
            'cash' => 'Cash Refund',
            'customer_credit' => 'Customer Credit',
        ];

        $aggregated = DB::table('booking_refunds')
            ->where('status', 'completed')
            ->whereIn('method', array_keys($labels))
            ->whereRaw("COALESCE(reason, '') <> ?", [\App\Services\Ecommerce\VoidRefundService::REASON])
            ->whereBetween(DB::raw('COALESCE(processed_at, created_at)'), [$start, $end])
            ->selectRaw('method')
            ->selectRaw('channel')
            ->selectRaw('COALESCE(SUM(amount), 0) as amount')
            ->groupBy('method', 'channel')
            ->get();

        $byMethod = [];
        foreach ($labels as $method => $_label) {
            $byMethod[$method] = ['online' => 0.0, 'offline' => 0.0];
        }
        foreach ($aggregated as $row) {
            $method = (string) $row->method;
            if (! isset($byMethod[$method])) {
                continue;
            }
            $channel = strtolower(trim((string) $row->channel));
            if ($channel === 'online') {
                $byMethod[$method]['online'] = (float) $row->amount;
            } elseif ($channel === 'offline') {
                $byMethod[$method]['offline'] = (float) $row->amount;
            }
        }

        return collect($labels)->map(function (string $label, string $method) use ($byMethod) {
            $online = $byMethod[$method]['online'] ?? 0.0;
            $offline = $byMethod[$method]['offline'] ?? 0.0;

            return [
                'key' => $method,
                'label' => $label,
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        })->values()->all();
    }

    /**
     * One row per configured payment gateway (type=ecommerce|booking), with online/offline split.
     * Order must belong to the workspace (product line for ecommerce; booking line for booking).
     * Amounts use line-item net totals (after discount), not order grand_total.
     */
    private function paymentMethodsForWorkspace(
        string $workspaceType,
        Carbon $start,
        Carbon $end
    ): array {
        $gateways = PaymentGateway::query()
            ->where('type', $workspaceType)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['key', 'name']);

        $keys = [];
        $labels = [];
        foreach ($gateways as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }
            $keys[] = $key;
            $labels[$key] = (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key);
        }

        $syntheticHead = [];
        $hasCashGateway = $gateways->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $keys[] = 'cash';
            $labels['cash'] = 'Cash';
            $syntheticHead[] = 'cash';
        }
        $hasQrpayGateway = $gateways->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'qrpay');
        if (! $hasQrpayGateway) {
            $keys[] = 'qrpay';
            $labels['qrpay'] = 'QR Pay (POS)';
            $syntheticHead[] = 'qrpay';
        }

        $amounts = $this->sumOrderNetAmountsGroupedByGateway($workspaceType, $start, $end, $keys);

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;
        $headRows = [];
        foreach ($syntheticHead as $key) {
            $online = $amounts[$key]['online'] ?? 0.0;
            $offline = $amounts[$key]['offline'] ?? 0.0;
            $sumOnline += $online;
            $sumOffline += $offline;
            $headRows[] = [
                'key' => $key,
                'label' => $labels[$key],
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }
        foreach ($gateways as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }
            $online = $amounts[$key]['online'] ?? 0.0;
            $offline = $amounts[$key]['offline'] ?? 0.0;
            $sumOnline += $online;
            $sumOffline += $offline;
            $rows[] = [
                'key' => $key,
                'label' => $labels[$key],
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        return [
            'rows' => array_merge($headRows, $rows),
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    /**
     * Union of ecommerce + booking gateway keys; sums line-item net amounts when the order has
     * product line(s) and/or booking line(s).
     */
    private function paymentMethodsForAllWorkspace(
        Carbon $start,
        Carbon $end
    ): array {
        $gateways = PaymentGateway::query()
            ->whereIn('type', [WorkspaceType::ECOMMERCE, WorkspaceType::BOOKING])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $merged = [];
        $seen = [];
        foreach ($gateways as $gw) {
            $k = strtolower(trim((string) $gw->key));
            if ($k === '') {
                continue;
            }
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $merged[] = $gw;
        }

        usort($merged, fn ($a, $b) => [$a->sort_order, $a->id] <=> [$b->sort_order, $b->id]);

        $keys = [];
        $labels = [];
        foreach ($merged as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }
            $keys[] = $key;
            $labels[$key] = (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key);
        }

        $syntheticHead = [];
        $hasCashGateway = collect($merged)->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $keys[] = 'cash';
            $labels['cash'] = 'Cash';
            $syntheticHead[] = 'cash';
        }
        $hasQrpayGateway = collect($merged)->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'qrpay');
        if (! $hasQrpayGateway) {
            $keys[] = 'qrpay';
            $labels['qrpay'] = 'QR Pay (POS)';
            $syntheticHead[] = 'qrpay';
        }

        $amounts = $this->sumOrderNetAmountsGroupedByGateway('all', $start, $end, $keys);

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;
        $headRows = [];
        foreach ($syntheticHead as $key) {
            $online = $amounts[$key]['online'] ?? 0.0;
            $offline = $amounts[$key]['offline'] ?? 0.0;
            $sumOnline += $online;
            $sumOffline += $offline;
            $headRows[] = [
                'key' => $key,
                'label' => $labels[$key],
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }
        foreach ($merged as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }
            $online = $amounts[$key]['online'] ?? 0.0;
            $offline = $amounts[$key]['offline'] ?? 0.0;
            $sumOnline += $online;
            $sumOffline += $offline;
            $rows[] = [
                'key' => $key,
                'label' => $labels[$key],
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        return [
            'rows' => array_merge($headRows, $rows),
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    /**
     * One scan of allocated payment nets, grouped by effective payment method + online/offline,
     * then rolled up to gateway keys (same variants rule as per-key sums).
     *
     * @param  list<string>  $keys
     * @return array<string, array{online: float, offline: float}>
     */
    private function sumOrderNetAmountsGroupedByGateway(
        string $workspaceType,
        Carbon $start,
        Carbon $end,
        array $keys
    ): array {
        $result = [];
        foreach ($keys as $key) {
            $result[$key] = ['online' => 0.0, 'offline' => 0.0];
        }
        if ($keys === []) {
            return $result;
        }

        $workspaceLineFilter = match ($workspaceType) {
            WorkspaceType::ECOMMERCE => $this->ecommerceWorkspaceLineFilterSql(),
            WorkspaceType::BOOKING => $this->bookingWorkspaceLineFilterSql(),
            default => $this->allWorkspaceLineFilterSql(),
        };
        $orderNetSql = $this->orderNetAmountSubquery($workspaceLineFilter);
        $allocatedNetSql = $this->allocatedPaymentNetSql($orderNetSql);
        $effectiveMethodSql = "LOWER(TRIM(COALESCE(CASE WHEN op.id IS NULL THEN o.payment_method ELSE op.payment_method END, '')))";

        $q = $this->applyOrderScope(
            ReportBranchScope::applyCurrent(DB::table('orders as o'), 'o.store_location_id')
                ->leftJoin('order_payments as op', 'op.order_id', '=', 'o.id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        );

        if ($workspaceType === WorkspaceType::ECOMMERCE) {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->where('oi.line_type', 'product');
            });
        } elseif ($workspaceType === WorkspaceType::BOOKING) {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES);
            });
        } else {
            $q->where(function ($outer) {
                $outer->whereExists(function ($sub) {
                    $sub->selectRaw('1')
                        ->from('order_items as oi')
                        ->whereColumn('oi.order_id', 'o.id')
                        ->where('oi.line_type', 'product');
                })->orWhereExists(function ($sub) {
                    $sub->selectRaw('1')
                        ->from('order_items as oi')
                        ->whereColumn('oi.order_id', 'o.id')
                        ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES);
                });
            });
        }

        $rows = $q
            ->selectRaw("{$effectiveMethodSql} as payment_method_key")
            ->selectRaw('(CASE WHEN o.created_by_user_id IS NULL THEN 1 ELSE 0 END) as is_online')
            ->selectRaw("COALESCE(SUM({$allocatedNetSql}), 0) as amount")
            ->groupByRaw("{$effectiveMethodSql}, (CASE WHEN o.created_by_user_id IS NULL THEN 1 ELSE 0 END)")
            ->get();

        $byMethod = [];
        foreach ($rows as $row) {
            $method = (string) $row->payment_method_key;
            $channel = ((int) $row->is_online === 1) ? 'online' : 'offline';
            $byMethod[$method][$channel] = (float) $row->amount;
        }

        foreach ($keys as $key) {
            foreach (SalesReportService::paymentMethodVariantsForMatch($key) as $variant) {
                $result[$key]['online'] += $byMethod[$variant]['online'] ?? 0.0;
                $result[$key]['offline'] += $byMethod[$variant]['offline'] ?? 0.0;
            }
        }

        return $result;
    }

    private function completedBookingServiceActivityByStaff(Carbon $start, Carbon $end, string $lineTotal): array
    {
        $bookings = ReportBranchScope::applyCurrent(DB::table('bookings as b'), 'b.store_location_id')
            ->where('b.status', 'COMPLETED')
            ->whereNotNull('b.completed_at')
            ->whereBetween('b.completed_at', [$start, $end])
            ->select('b.id', 'b.staff_id')
            ->get();

        $bookingIds = $bookings->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $splitRows = empty($bookingIds)
            ? collect()
            : DB::table('booking_service_staff_splits')
                ->whereIn('booking_id', $bookingIds)
                ->get(['booking_id', 'staff_id', 'split_percent', 'share_amount'])
                ->groupBy('booking_id');

        $bookingTotals = empty($bookingIds)
            ? collect()
            : $this->applyOrderScope(
                DB::table('order_items as oi')
                    ->join('orders as o', 'o.id', '=', 'oi.order_id')
                    ->whereIn('oi.booking_id', $bookingIds)
            )
                ->whereIn('oi.line_type', ['booking_settlement', 'booking_addon'])
                ->groupBy('oi.booking_id')
                ->selectRaw('oi.booking_id as booking_id')
                ->selectRaw("COALESCE(SUM($lineTotal), 0) as service_amount")
                ->pluck('service_amount', 'booking_id')
                ->map(fn ($amount) => round((float) $amount, 2));

        $byStaff = [];
        foreach ($bookings as $booking) {
            $bookingId = (int) $booking->id;
            $serviceAmount = (float) ($bookingTotals[$bookingId] ?? 0);
            $splits = collect($splitRows->get($bookingId, []))
                ->map(fn ($row) => [
                    'staff_id' => (int) ($row->staff_id ?? 0),
                    'share_percent' => (float) ($row->split_percent ?? 0),
                    'share_amount' => $row->share_amount !== null ? (float) $row->share_amount : null,
                ])
                ->filter(fn (array $row) => $row['staff_id'] > 0 && ($row['share_percent'] > 0 || ($row['share_amount'] ?? 0) > 0))
                ->values();

            if ($splits->isEmpty() && (int) ($booking->staff_id ?? 0) > 0) {
                $splits = collect([['staff_id' => (int) $booking->staff_id, 'share_percent' => 100.0, 'share_amount' => null]]);
            }

            foreach ($splits as $split) {
                $splitAmount = ($split['share_amount'] ?? 0) > 0
                    ? round((float) $split['share_amount'], 2)
                    : round($serviceAmount * (((float) $split['share_percent']) / 100), 2);
                $this->addStaffServiceActivity(
                    $byStaff,
                    (int) $split['staff_id'],
                    $splitAmount
                );
            }
        }

        $bookingProductOptionTotal = "COALESCE((SELECT SUM(COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(oi.quantity, 1)::numeric, 0)) FROM jsonb_array_elements(COALESCE(oi.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option)), 0)";
        $bookingProductMatchingOption = "COALESCE((SELECT COALESCE(NULLIF(option_row.option->>'line_total_after_discount', '')::numeric, NULLIF(option_row.option->>'extra_price', '')::numeric * COALESCE(oi.quantity, 1)::numeric, 0) FROM jsonb_array_elements(COALESCE(oi.selected_booking_product_options::jsonb, '[]'::jsonb)) AS question_row(question) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(question_row.question->'options', '[]'::jsonb)) AS option_row(option) WHERE option_row.option->>'id' = sps.line_ref_id LIMIT 1), sps.amount_basis)";
        $bookingProductSplitAmount = "(CASE WHEN sps.line_type = 'booking_product_base' THEN GREATEST(0, ($lineTotal) - ($bookingProductOptionTotal)) WHEN sps.line_type = 'booking_product_option' THEN COALESCE($bookingProductMatchingOption, sps.amount_basis, $lineTotal) ELSE COALESCE(sps.amount_basis, $lineTotal) END)";
        $bookingProductSplitSalesSql = StaffSplitNormalizer::splitSalesSql('sps', $bookingProductSplitAmount);

        $bookingProductSplitRows = $this->applyOrderScope(
            DB::table('order_item_staff_splits as sps')
                ->join('order_items as oi', 'oi.id', '=', 'sps.order_item_id')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'booking_product')
            ->whereNotNull('sps.staff_id')
            ->groupBy('sps.staff_id')
            ->selectRaw('sps.staff_id as staff_id')
            ->selectRaw('COUNT(*) as service_count')
            ->selectRaw("COALESCE(SUM({$bookingProductSplitSalesSql}), 0) as service_amount")
            ->get();

        foreach ($bookingProductSplitRows as $row) {
            $this->addStaffServiceActivity(
                $byStaff,
                (int) ($row->staff_id ?? 0),
                round((float) ($row->service_amount ?? 0), 2),
                (int) ($row->service_count ?? 0)
            );
        }

        $bookingProductFallbackRows = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->leftJoin('users as creator', 'creator.id', '=', 'o.created_by_user_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'booking_product')
            ->whereNotExists(function (Builder $q) {
                $q->selectRaw('1')
                    ->from('order_item_staff_splits as sps_exists')
                    ->whereColumn('sps_exists.order_item_id', 'oi.id');
            })
            ->whereNotNull(DB::raw('COALESCE(oi.staff_id, creator.staff_id)'))
            ->groupBy(DB::raw('COALESCE(oi.staff_id, creator.staff_id)'))
            ->selectRaw('COALESCE(oi.staff_id, creator.staff_id) as staff_id')
            ->selectRaw('COUNT(*) as service_count')
            ->selectRaw("COALESCE(SUM($lineTotal), 0) as service_amount")
            ->get();

        foreach ($bookingProductFallbackRows as $row) {
            $this->addStaffServiceActivity(
                $byStaff,
                (int) ($row->staff_id ?? 0),
                round((float) ($row->service_amount ?? 0), 2),
                (int) ($row->service_count ?? 0)
            );
        }

        if (empty($byStaff)) {
            return [];
        }

        $staffNames = DB::table('staffs')
            ->whereIn('id', array_keys($byStaff))
            ->pluck('name', 'id');

        return collect($byStaff)
            ->map(fn (array $row) => [
                'staff_id' => (int) $row['staff_id'],
                'name' => (string) ($staffNames[$row['staff_id']] ?? ('Staff #'.$row['staff_id'])),
                'service_count' => (int) $row['service_count'],
                'service_amount' => round((float) $row['service_amount'], 2),
                'total' => round((float) $row['service_amount'], 2),
            ])
            ->sortByDesc('service_amount')
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{staff_id: int, service_count: int, service_amount: float}>  $byStaff
     */
    private function addStaffServiceActivity(array &$byStaff, int $staffId, float $amount, int $count = 1): void
    {
        if ($staffId <= 0 || $count <= 0) {
            return;
        }

        if (! isset($byStaff[$staffId])) {
            $byStaff[$staffId] = [
                'staff_id' => $staffId,
                'service_count' => 0,
                'service_amount' => 0.0,
            ];
        }

        $byStaff[$staffId]['service_count'] += $count;
        $byStaff[$staffId]['service_amount'] += $amount;
    }

}
