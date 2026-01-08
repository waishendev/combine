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
            ->whereNotNull('refunded_at')
            ->whereBetween('refunded_at', [$start, $end])
            ->sum('refund_amount');
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

        return [
            'revenue' => $revenue,
            'orders_count' => $ordersCount,
            'new_customers' => $newCustomers,
            'refund_amount' => $refundAmount,
        ];
    }

    private function monthlySales(): array
    {
        $end = Carbon::today()->endOfMonth()->endOfDay();
        $start = Carbon::today()->startOfMonth()->subMonths(4);

        $rows = Order::query()
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->selectRaw("to_char(COALESCE(placed_at, created_at), 'YYYY-MM') as month")
            ->selectRaw('SUM(grand_total) as revenue')
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
                'orders_count' => $row ? (int) $row->orders_count : 0,
            ];
            $cursor->addMonth();
        }

        return $months;
    }

    private function topProducts(Carbon $start, Carbon $end): array
    {
        $rows = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->groupBy('p.id', 'p.name', 'p.sku')
            ->select(
                'p.id as product_id',
                'p.name as product_name',
                'p.sku',
                DB::raw('SUM(oi.quantity) as qty'),
                DB::raw('SUM(oi.line_total) as revenue')
            )
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        return $rows
            ->map(function ($row) {
                $revenue = (float) $row->revenue;
                $refundAmount = 0.0;

                // TODO: Calculate refund amounts per product using return request items once available.

                return [
                    'product_id' => (int) $row->product_id,
                    'product_name' => $row->product_name,
                    'sku' => $row->sku,
                    'qty' => (int) $row->qty,
                    'revenue' => $revenue,
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
