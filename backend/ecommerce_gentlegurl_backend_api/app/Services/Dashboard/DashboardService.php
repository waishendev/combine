<?php

namespace App\Services\Dashboard;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\ReturnRequest;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function getOverview(Carbon $start, Carbon $end, Carbon $previousStart, Carbon $previousEnd): array
    {
        $currentKpis = $this->calculateKpis($start, $end);
        $previousKpis = $this->calculateKpis($previousStart, $previousEnd);
        $monthlySales = $this->monthlySales();
        $topProducts = $this->topProducts($start, $end);

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'kpis' => [
                'revenue' => $this->withComparison($currentKpis['revenue'], $previousKpis['revenue']),
                'net_revenue' => $this->withComparison($currentKpis['net_revenue'], $previousKpis['net_revenue']),
                'orders_count' => $this->withComparison($currentKpis['orders_count'], $previousKpis['orders_count']),
                'new_customers' => $this->withComparison($currentKpis['new_customers'], $previousKpis['new_customers']),
                'refund_amount' => $this->withComparison($currentKpis['refund_amount'], $previousKpis['refund_amount']),
            ],
            'charts' => [
                'monthly_sales' => $monthlySales,
            ],
            'top_products' => $topProducts,
        ];
    }

    public function resolveCurrentRange(Request $request): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');
        $defaultRangeApplied = !($hasDateFrom && $hasDateTo);

        if ($defaultRangeApplied) {
            $today = Carbon::today();
            $start = $today->copy()->startOfMonth();
            $end = $today->copy()->endOfMonth()->endOfDay();
        } else {
            $start = Carbon::parse($request->query('date_from'))->startOfDay();
            $end = Carbon::parse($request->query('date_to'))->endOfDay();
        }

        return [$start, $end, $defaultRangeApplied];
    }

    public function resolvePreviousRange(Carbon $start, Carbon $end, bool $defaultRangeApplied): array
    {
        if ($defaultRangeApplied) {
            $previousStart = $start->copy()->subMonthNoOverflow()->startOfMonth();
            $previousEnd = $start->copy()->subMonthNoOverflow()->endOfMonth()->endOfDay();

            return [$previousStart, $previousEnd];
        }

        $days = $start->diffInDays($end) + 1;
        $previousStart = $start->copy()->subDays($days);
        $previousEnd = $end->copy()->subDays($days);

        return [$previousStart, $previousEnd];
    }

    private function baseOrdersQuery(Carbon $start, Carbon $end): Builder
    {
        return Order::query()
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT);
    }

    private function refundAmountForRange(Carbon $start, Carbon $end): float
    {
        return (float) ReturnRequest::query()
            ->join('orders as o', 'o.id', '=', 'return_requests.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereNotNull('return_requests.refunded_at')
            ->sum('return_requests.refund_amount');
    }

    private function calculateKpis(Carbon $start, Carbon $end): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);
        $revenue = (float) (clone $baseQuery)->sum('grand_total');
        $ordersCount = (int) (clone $baseQuery)->count();
        $newCustomers = (int) Customer::query()
            ->whereBetween('created_at', [$start, $end])
            ->count();
        $refundAmount = $this->refundAmountForRange($start, $end);
        $netRevenue = $revenue - $refundAmount;

        return [
            'revenue' => $revenue,
            'net_revenue' => $netRevenue,
            'orders_count' => $ordersCount,
            'new_customers' => $newCustomers,
            'refund_amount' => $refundAmount,
        ];
    }

    private function monthlySales(): array
    {
        $end = Carbon::today()->endOfMonth()->endOfDay();
        $start = Carbon::today()->startOfMonth()->subMonths(4);

        $refundsSubquery = ReturnRequest::query()
            ->join('orders as o', 'o.id', '=', 'return_requests.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereNotNull('return_requests.refunded_at')
            ->groupBy('return_requests.order_id')
            ->select('return_requests.order_id', DB::raw('SUM(return_requests.refund_amount) as refund_amount'));

        $rows = Order::query()
            ->leftJoinSub($refundsSubquery, 'order_refunds', 'orders.id', '=', 'order_refunds.order_id')
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->selectRaw("to_char(COALESCE(placed_at, created_at), 'YYYY-MM') as month")
            ->selectRaw('SUM(grand_total) as revenue')
            ->selectRaw('COALESCE(SUM(order_refunds.refund_amount), 0) as return_amount')
            ->selectRaw('SUM(grand_total - COALESCE(order_refunds.refund_amount, 0)) as net_revenue')
            ->selectRaw('COUNT(*) as orders_count')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $months = [];
        $cursor = $start->copy();

        while ($cursor->lte($end)) {
            $monthKey = $cursor->format('Y-m');
            $row = $rows->get($monthKey);
            $months[] = [
                'month' => $monthKey,
                'revenue' => $row ? (float) $row->revenue : 0.0,
                'return_amount' => $row ? (float) $row->return_amount : 0.0,
                'net_revenue' => $row ? (float) $row->net_revenue : 0.0,
                'orders_count' => $row ? (int) $row->orders_count : 0,
            ];
            $cursor->addMonth();
        }

        return $months;
    }

    private function topProducts(Carbon $start, Carbon $end): array
    {
        $refundsSubquery = ReturnRequest::query()
            ->join('orders as o', 'o.id', '=', 'return_requests.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereNotNull('return_requests.refunded_at')
            ->groupBy('return_requests.order_id')
            ->select('return_requests.order_id', DB::raw('SUM(return_requests.refund_amount) as refund_amount'));

        $rows = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'oi.product_variant_id')
            ->leftJoinSub($refundsSubquery, 'order_refunds', 'o.id', '=', 'order_refunds.order_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->groupBy(
                'p.id',
                'p.name',
                'p.sku',
                'oi.product_variant_id',
                DB::raw('COALESCE(oi.variant_name_snapshot, pv.title)'),
                DB::raw('COALESCE(oi.variant_sku_snapshot, pv.sku)')
            )
            ->select(
                'p.id as product_id',
                'p.name as product_name',
                'p.sku as product_sku',
                'oi.product_variant_id as variant_id',
                DB::raw('COALESCE(oi.variant_name_snapshot, pv.title) as variant_name'),
                DB::raw('COALESCE(oi.variant_sku_snapshot, pv.sku) as variant_sku'),
                DB::raw('SUM(oi.quantity) as qty'),
                DB::raw('SUM(oi.line_total) as revenue'),
                DB::raw(
                    'SUM(oi.line_total - (CASE WHEN o.grand_total > 0 THEN (oi.line_total / o.grand_total) * COALESCE(order_refunds.refund_amount, 0) ELSE 0 END)) as net_revenue'
                )
            )
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        return $rows
            ->map(function ($row) {
                $revenue = (float) $row->revenue;
                $netRevenue = (float) $row->net_revenue;
                $refundAmount = max($revenue - $netRevenue, 0);
                $variantName = $row->variant_name ?? null;
                $displayName = $variantName ? "{$row->product_name} ({$variantName})" : $row->product_name;
                $resolvedSku = $row->variant_sku ?: $row->product_sku;

                return [
                    'product_id' => (int) $row->product_id,
                    'product_name' => $row->product_name,
                    'product_sku' => $row->product_sku,
                    'variant_id' => $row->variant_id ? (int) $row->variant_id : null,
                    'variant_name' => $variantName,
                    'variant_sku' => $row->variant_sku,
                    'display_name' => $displayName,
                    'sku' => $resolvedSku,
                    'qty' => (int) $row->qty,
                    'revenue' => $revenue,
                    'net_revenue' => $netRevenue,
                    'refund_amount' => $refundAmount,
                    'refund_percent' => $revenue > 0 ? ($refundAmount / $revenue) * 100 : 0.0,
                ];
            })
            ->values()
            ->all();
    }

    private function withComparison(float|int $current, float|int $previous): array
    {
        $delta = $current - $previous;

        if ($previous == 0.0) {
            $deltaPercent = $current == 0.0 ? 0.0 : 100.0;
        } else {
            $deltaPercent = ($delta / $previous) * 100;
        }

        $trend = 'flat';
        if ($delta > 0) {
            $trend = 'up';
        } elseif ($delta < 0) {
            $trend = 'down';
        }

        return [
            'current' => $current,
            'previous' => $previous,
            'delta' => $delta,
            'delta_percent' => round($deltaPercent, 2),
            'trend' => $trend,
        ];
    }
}
