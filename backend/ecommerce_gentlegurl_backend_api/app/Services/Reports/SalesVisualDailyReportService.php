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
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'EXTRACT(YEAR FROM ' . $this->orderBillAtSql() . ')::int';

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
                'total_sales' => 0.0,
            ];
            $cursor->addDay();
        }

        $bucketExpression = 'DATE(' . $this->orderBillAtSql() . ')';

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
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'EXTRACT(MONTH FROM ' . $this->orderBillAtSql() . ')::int';

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
                'total_sales' => 0.0,
            ];
        }

        $bucketExpression = 'DATE(' . $this->orderBillAtSql() . ')';

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

        $payload = $this->salesSummaryPayload($year, $month, array_values($rows));
        $payload['month_from'] = $month;
        $payload['month_to'] = $month;

        return $payload;
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
            DB::table('orders as o')
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

    private function salesSummaryPayload(int $year, ?int $month, array $rows): array
    {
        $rows = array_map(function (array $row) {
            $row['ecommerce_sales'] = round((float) ($row['ecommerce_sales'] ?? 0), 2);
            $row['booking_sales'] = round((float) ($row['booking_sales'] ?? 0), 2);
            $row['booking_count'] = (int) ($row['booking_count'] ?? 0);
            $row['total_sales'] = round($row['ecommerce_sales'] + $row['booking_sales'], 2);
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

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
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

        $bookingSub = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
                ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.payment_method')
            ->selectRaw("$lineTotal as net_amount")
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' WHEN 'booking_product' THEN 'booking_product' ELSE 'package_purchase' END as line_kind")
            ->selectRaw('oi.booking_id');

        $itemAgg = DB::query()->fromSub($bookingSub, 'r')
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind IN ('final_settlement','addon','booking_product') THEN net_amount ELSE 0 END), 0) as service_bucket")
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind = 'package_purchase' THEN net_amount ELSE 0 END), 0) as multi_package")
            ->first();

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
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
                'service' => round((float) ($itemAgg->service_bucket ?? 0), 2),
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
                'amount' => round((float) $serviceConsumedQuery->value('v'), 2),
                'message' => 'Final settlement lines for booking orders in this period.',
            ],
            'staff' => [
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

        $itemEcommerce = $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            // service_package lines are booking/POS package purchases and are counted in
            // $itemBooking below. Including them here too doubles the Package item type
            // in the combined All workspace (e.g. RM899 shows as RM1,798).
            ->whereIn('oi.line_type', ['product', 'service'])
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'product' THEN $lineTotal ELSE 0 END), 0) as product")
            ->selectRaw("COALESCE(SUM(CASE WHEN oi.line_type = 'service' THEN $lineTotal ELSE 0 END), 0) as service")
            ->selectRaw("0 as multi_package")
            ->first();

        $bookingSub = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
                ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.payment_method')
            ->selectRaw("$lineTotal as net_amount")
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' WHEN 'booking_product' THEN 'booking_product' ELSE 'package_purchase' END as line_kind")
            ->selectRaw('oi.booking_id');

        $itemBooking = DB::query()->fromSub($bookingSub, 'r')
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind IN ('final_settlement','addon','booking_product') THEN net_amount ELSE 0 END), 0) as service_bucket")
            ->selectRaw("COALESCE(SUM(CASE WHEN line_kind = 'package_purchase' THEN net_amount ELSE 0 END), 0) as multi_package")
            ->first();

        $roster = $this->allStaffRoster();
        $ecKeyed = $this->keyRowsByStaffId($this->ecommerceStaffProductSales($start, $end, $lineTotal));
        $staffSales = $this->padStaffWithEcommerceProductSales($roster, $ecKeyed);
        $salesTotal = round(array_sum(array_column($staffSales, 'product_sales')), 2);

        $svcKeyed = $this->keyRowsByStaffId($this->bookingStaffCommissionSales($start, $end));
        $staffService = $this->padStaffWithServiceActivity($roster, $svcKeyed);
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
            'refunds' => $this->refundRows($start, $end),
            'refunds' => $this->refundRows($start, $end),
            'item_types' => [
                'estimate' => true,
                'product' => round((float) ($itemEcommerce->product ?? 0), 2),
                'service' => round((float) ($itemEcommerce->service ?? 0) + (float) ($itemBooking->service_bucket ?? 0), 2),
                'multi_package' => round((float) ($itemEcommerce->multi_package ?? 0) + (float) ($itemBooking->multi_package ?? 0), 2),
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
                'sales_activity' => $staffSales,
                'sales_activity_total' => $salesTotal,
                'service_activity' => $staffService,
                'service_activity_total' => array_sum(array_column($staffService, 'service_count')),
                'service_activity_amount_total' => round(array_sum(array_column($staffService, 'service_amount')), 2),
            ],
        ];
    }

    private function packageRedemptionValue(Carbon $start, Carbon $end): float
    {
        $redemptionExpr = $this->packageRedemptionLineValueExpr('oi');

        return round((float) $this->applyOrderScope(
            DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end]),
            'o'
        )
            ->whereIn('oi.line_type', ['booking_settlement', 'booking_addon'])
            ->selectRaw("COALESCE(SUM($redemptionExpr), 0) as v")
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
     */
    private function excludePackageRefundedBookingDeposits(Builder $query, string $orderItemAlias = 'order_items'): Builder
    {
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

    /** @return list<array{staff_id: int, name: string}> */
    private function allStaffRoster(): array
    {
        return DB::table('staffs')
            ->orderBy('name')
            ->select('id', 'name')
            ->get()
            ->map(fn ($r) => [
                'staff_id' => (int) $r->id,
                'name' => (string) $r->name,
            ])
            ->values()
            ->all();
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
        $settledBookingIds = $this->applyOrderScope(
            DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.line_type', 'booking_settlement')
                ->whereBetween(DB::raw($this->orderBillAtSql('orders')), [$start, $end])
                ->whereNotNull('order_items.booking_id'),
            'orders'
        )
            ->pluck('order_items.booking_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $byStaff = [];
        $countedBookingsByStaff = [];

        if (! empty($settledBookingIds)) {
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
            $this->excludePackageRefundedBookingDeposits($splitRowsQuery);
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
            $this->excludePackageRefundedBookingDeposits($fallbackItemsQuery);
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
                $bookingStaffFallback = DB::table('bookings')
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
            DB::table('orders')
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

        return collect($labels)->map(function (string $label, string $method) use ($start, $end) {
            $base = DB::table('booking_refunds')
                ->where('status', 'completed')
                ->where('method', $method)
                ->whereBetween(DB::raw('COALESCE(processed_at, created_at)'), [$start, $end]);
            $online = (clone $base)->where('channel', 'online')->sum('amount');
            $offline = (clone $base)->where('channel', 'offline')->sum('amount');

            return [
                'key' => $method,
                'label' => $label,
                'online' => round((float) $online, 2),
                'offline' => round((float) $offline, 2),
                'total' => round((float) $online + (float) $offline, 2),
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

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;

        foreach ($gateways as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }

            $online = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, $key, true);
            $offline = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, $key, false);

            $sumOnline += $online;
            $sumOffline += $offline;

            $rows[] = [
                'key' => $key,
                'label' => (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key),
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        $syntheticHead = [];

        $hasCashGateway = $gateways->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $cashOnline = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, 'cash', true);
            $cashOffline = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, 'cash', false);
            $sumOnline += $cashOnline;
            $sumOffline += $cashOffline;
            $syntheticHead[] = [
                'key' => 'cash',
                'label' => 'Cash',
                'online' => round($cashOnline, 2),
                'offline' => round($cashOffline, 2),
                'total' => round($cashOnline + $cashOffline, 2),
            ];
        }

        $hasQrpayGateway = $gateways->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'qrpay');
        if (! $hasQrpayGateway) {
            $qrOnline = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, 'qrpay', true);
            $qrOffline = $this->sumOrderNetAmountForGatewayKey($workspaceType, $start, $end, 'qrpay', false);
            $sumOnline += $qrOnline;
            $sumOffline += $qrOffline;
            $syntheticHead[] = [
                'key' => 'qrpay',
                'label' => 'QR Pay (POS)',
                'online' => round($qrOnline, 2),
                'offline' => round($qrOffline, 2),
                'total' => round($qrOnline + $qrOffline, 2),
            ];
        }

        $rows = array_merge($syntheticHead, $rows);

        return [
            'rows' => $rows,
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    private function sumOrderNetAmountForGatewayKey(
        string $workspaceType,
        Carbon $start,
        Carbon $end,
        string $paymentKey,
        bool $online
    ): float {
        $methodVariants = SalesReportService::paymentMethodVariantsForMatch($paymentKey);
        $workspaceLineFilter = $workspaceType === WorkspaceType::ECOMMERCE
            ? $this->ecommerceWorkspaceLineFilterSql()
            : $this->bookingWorkspaceLineFilterSql();
        $orderNetSql = $this->orderNetAmountSubquery($workspaceLineFilter);
        $allocatedNetSql = $this->allocatedPaymentNetSql($orderNetSql);

        $q = $this->applyOrderScope(
            DB::table('orders as o')
                ->leftJoin('order_payments as op', 'op.order_id', '=', 'o.id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where(function ($q) use ($methodVariants) {
                $q->whereIn(DB::raw('LOWER(TRIM(COALESCE(op.payment_method, \'\')))'), $methodVariants)
                    ->orWhere(function ($fallback) use ($methodVariants) {
                        $fallback->whereNull('op.id')
                            ->whereIn(DB::raw('LOWER(TRIM(COALESCE(o.payment_method, \'\')))'), $methodVariants);
                    });
            });

        if ($online) {
            $q->whereNull('o.created_by_user_id');
        } else {
            $q->whereNotNull('o.created_by_user_id');
        }

        if ($workspaceType === WorkspaceType::ECOMMERCE) {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->where('oi.line_type', 'product');
            });
        } else {
            $q->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_items as oi')
                    ->whereColumn('oi.order_id', 'o.id')
                    ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES);
            });
        }

        return (float) $q->sum(DB::raw($allocatedNetSql));
    }

    /**
     * Union of ecommerce + booking gateway keys; sums line-item net amounts when the order has
     * product line(s) and/or booking line(s).
     */
    private function paymentMethodsForAllWorkspace(
        Carbon $start,
        Carbon $end
    ): array {
        $ec = PaymentGateway::query()
            ->where('type', WorkspaceType::ECOMMERCE)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        $bk = PaymentGateway::query()
            ->where('type', WorkspaceType::BOOKING)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $merged = [];
        $seen = [];
        foreach ([$ec, $bk] as $collection) {
            foreach ($collection as $gw) {
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
        }

        usort($merged, fn ($a, $b) => [$a->sort_order, $a->id] <=> [$b->sort_order, $b->id]);

        $rows = [];
        $sumOnline = 0.0;
        $sumOffline = 0.0;

        foreach ($merged as $gw) {
            $key = trim((string) $gw->key);
            if ($key === '') {
                continue;
            }

            $online = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, $key, true);
            $offline = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, $key, false);

            $sumOnline += $online;
            $sumOffline += $offline;

            $rows[] = [
                'key' => $key,
                'label' => (string) (($gw->name !== null && trim((string) $gw->name) !== '') ? $gw->name : $key),
                'online' => round($online, 2),
                'offline' => round($offline, 2),
                'total' => round($online + $offline, 2),
            ];
        }

        $syntheticHead = [];

        $hasCashGateway = collect($merged)->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'cash');
        if (! $hasCashGateway) {
            $cashOnline = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, 'cash', true);
            $cashOffline = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, 'cash', false);
            $sumOnline += $cashOnline;
            $sumOffline += $cashOffline;
            $syntheticHead[] = [
                'key' => 'cash',
                'label' => 'Cash',
                'online' => round($cashOnline, 2),
                'offline' => round($cashOffline, 2),
                'total' => round($cashOnline + $cashOffline, 2),
            ];
        }

        $hasQrpayGateway = collect($merged)->contains(fn ($gw) => strtolower(trim((string) $gw->key)) === 'qrpay');
        if (! $hasQrpayGateway) {
            $qrOnline = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, 'qrpay', true);
            $qrOffline = $this->sumOrderNetAmountForGatewayKeyAll($start, $end, 'qrpay', false);
            $sumOnline += $qrOnline;
            $sumOffline += $qrOffline;
            $syntheticHead[] = [
                'key' => 'qrpay',
                'label' => 'QR Pay (POS)',
                'online' => round($qrOnline, 2),
                'offline' => round($qrOffline, 2),
                'total' => round($qrOnline + $qrOffline, 2),
            ];
        }

        $rows = array_merge($syntheticHead, $rows);

        return [
            'rows' => $rows,
            'totals' => [
                'online' => round($sumOnline, 2),
                'offline' => round($sumOffline, 2),
            ],
        ];
    }

    private function sumOrderNetAmountForGatewayKeyAll(
        Carbon $start,
        Carbon $end,
        string $paymentKey,
        bool $online
    ): float {
        $methodVariants = SalesReportService::paymentMethodVariantsForMatch($paymentKey);
        $orderNetSql = $this->orderNetAmountSubquery($this->allWorkspaceLineFilterSql());
        $allocatedNetSql = $this->allocatedPaymentNetSql($orderNetSql);

        $q = $this->applyOrderScope(
            DB::table('orders as o')
                ->leftJoin('order_payments as op', 'op.order_id', '=', 'o.id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where(function ($q) use ($methodVariants) {
                $q->whereIn(DB::raw('LOWER(TRIM(COALESCE(op.payment_method, \'\')))'), $methodVariants)
                    ->orWhere(function ($fallback) use ($methodVariants) {
                        $fallback->whereNull('op.id')
                            ->whereIn(DB::raw('LOWER(TRIM(COALESCE(o.payment_method, \'\')))'), $methodVariants);
                    });
            });

        if ($online) {
            $q->whereNull('o.created_by_user_id');
        } else {
            $q->whereNotNull('o.created_by_user_id');
        }

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

        return (float) $q->sum(DB::raw($allocatedNetSql));
    }

    private function completedBookingServiceActivityByStaff(Carbon $start, Carbon $end, string $lineTotal): array
    {
        $bookings = DB::table('bookings as b')
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
