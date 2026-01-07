<?php

namespace App\Services\Dashboard;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\ReturnRequest;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function getOverview(Carbon $start, Carbon $end): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);
        $revenue = (float) (clone $baseQuery)->sum('grand_total');
        $ordersCount = (int) (clone $baseQuery)->count();
        $newCustomers = (int) Customer::query()
            ->whereBetween('created_at', [$start, $end])
            ->count();
        $refundAmount = $this->refundAmountForRange($start, $end);
        $monthlySales = $this->monthlySales();
        $topProducts = $this->topProducts($start, $end);

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'kpis' => [
                'revenue' => $revenue,
                'orders_count' => $ordersCount,
                'new_customers' => $newCustomers,
                'refund_amount' => $refundAmount,
            ],
            'charts' => [
                'monthly_sales' => $monthlySales,
            ],
            'top_products' => $topProducts,
        ];
    }

    private function baseOrdersQuery(Carbon $start, Carbon $end): Builder
    {
        return Order::query()
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->where('payment_status', 'paid')
            ->whereIn('status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT);
    }

    private function refundAmountForRange(Carbon $start, Carbon $end): float
    {
        return (float) ReturnRequest::query()
            ->whereNotNull('refunded_at')
            ->whereBetween('refunded_at', [$start, $end])
            ->sum('refund_amount');
    }

    private function monthlySales(): array
    {
        $end = Carbon::today()->endOfMonth()->endOfDay();
        $start = Carbon::today()->startOfMonth()->subMonths(4);

        $rows = Order::query()
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->where('payment_status', 'paid')
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
            ->where('o.payment_status', 'paid')
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
}
