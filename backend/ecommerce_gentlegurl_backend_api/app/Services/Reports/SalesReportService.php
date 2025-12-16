<?php

namespace App\Services\Reports;

use App\Models\Ecommerce\Order;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class SalesReportService
{
    public const VALID_ORDER_STATUSES_FOR_REPORT = ['paid', 'packed', 'shipped', 'completed'];

    public function getOverview(Carbon $start, Carbon $end): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);

        $ordersCount = (clone $baseQuery)->count();
        $revenue = (float) (clone $baseQuery)->sum('grand_total');
        $itemsCount = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->where('orders.payment_status', 'paid')
            ->whereIn('orders.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->sum('order_items.quantity');

        $byStatus = (clone $baseQuery)
            ->select('status', DB::raw('COUNT(*) as orders_count'), DB::raw('SUM(grand_total) as revenue'))
            ->groupBy('status')
            ->get()
            ->map(function ($row) {
                return [
                    'status' => $row->status,
                    'orders_count' => (int) $row->orders_count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'totals' => [
                'orders_count' => (int) $ordersCount,
                'items_count' => $itemsCount,
                'revenue' => $revenue,
                'average_order_value' => $ordersCount > 0 ? $revenue / $ordersCount : 0.0,
            ],
            'by_status' => $byStatus,
        ];
    }

    public function getDaily(Carbon $start, Carbon $end, string $groupBy = 'day'): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);
        $groupBy = $groupBy === 'month' ? 'month' : 'day';

        $dateExpression = $groupBy === 'month'
            ? DB::raw("to_char(COALESCE(placed_at, created_at), 'YYYY-MM')")
            : DB::raw("to_char(COALESCE(placed_at, created_at), 'YYYY-MM-DD')");

        $itemsSubquery = DB::table('order_items')
            ->select('order_id', DB::raw('SUM(quantity) as items_count'))
            ->groupBy('order_id');

        $rows = $baseQuery
            ->leftJoinSub($itemsSubquery, 'order_item_sums', 'orders.id', '=', 'order_item_sums.order_id')
            ->selectRaw("{$dateExpression} as date_bucket")
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(order_item_sums.items_count), 0) as items_count')
            ->selectRaw('SUM(grand_total) as revenue')
            ->groupBy('date_bucket')
            ->orderBy('date_bucket')
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->date_bucket,
                    'orders_count' => (int) $row->orders_count,
                    'items_count' => (int) $row->items_count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'rows' => $rows,
        ];
    }

    public function getByCategory(Carbon $start, Carbon $end, int $limit = 50): array
    {
        $rows = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->join('product_categories as pc', 'pc.product_id', '=', 'p.id')
            ->join('categories as c', 'c.id', '=', 'pc.category_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->where('o.payment_status', 'paid')
            ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->groupBy('c.id', 'c.name')
            ->select(
                'c.id as category_id',
                'c.name as category_name',
                DB::raw('COUNT(DISTINCT o.id) as orders_count'),
                DB::raw('SUM(oi.quantity) as items_count'),
                DB::raw('SUM(oi.line_total) as revenue')
            )
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                return [
                    'category_id' => (int) $row->category_id,
                    'category_name' => $row->category_name,
                    'orders_count' => (int) $row->orders_count,
                    'items_count' => (int) $row->items_count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'rows' => $rows,
        ];
    }

    public function getTopProducts(Carbon $start, Carbon $end, int $limit = 20): array
    {
        $rows = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->where('o.payment_status', 'paid')
            ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->groupBy('p.id', 'p.name', 'p.sku')
            ->select(
                'p.id as product_id',
                'p.name as product_name',
                'p.sku',
                DB::raw('COUNT(DISTINCT o.id) as orders_count'),
                DB::raw('SUM(oi.quantity) as items_count'),
                DB::raw('SUM(oi.line_total) as revenue')
            )
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                return [
                    'product_id' => (int) $row->product_id,
                    'product_name' => $row->product_name,
                    'sku' => $row->sku,
                    'orders_count' => (int) $row->orders_count,
                    'items_count' => (int) $row->items_count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'rows' => $rows,
        ];
    }

    public function getTopCustomers(Carbon $start, Carbon $end, int $limit = 20): array
    {
        $itemsSubquery = DB::table('order_items')
            ->select('order_id', DB::raw('SUM(quantity) as items_count'))
            ->groupBy('order_id');

        $rows = $this->baseOrdersQuery($start, $end)
            ->join('customers as c', 'orders.customer_id', '=', 'c.id')
            ->leftJoinSub($itemsSubquery, 'order_item_sums', 'orders.id', '=', 'order_item_sums.order_id')
            ->groupBy('c.id', 'c.name', 'c.email')
            ->select(
                'c.id as customer_id',
                'c.name as customer_name',
                'c.email as customer_email',
                DB::raw('COUNT(orders.id) as orders_count'),
                DB::raw('COALESCE(SUM(order_item_sums.items_count), 0) as items_count'),
                DB::raw('SUM(orders.grand_total) as revenue')
            )
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                $ordersCount = (int) $row->orders_count;
                $revenue = (float) $row->revenue;

                return [
                    'customer_id' => (int) $row->customer_id,
                    'customer_name' => $row->customer_name,
                    'customer_email' => $row->customer_email,
                    'orders_count' => $ordersCount,
                    'items_count' => (int) $row->items_count,
                    'revenue' => $revenue,
                    'average_order_value' => $ordersCount > 0 ? $revenue / $ordersCount : 0.0,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'rows' => $rows,
        ];
    }

    private function baseOrdersQuery(Carbon $start, Carbon $end): Builder
    {
        return Order::query()
            ->whereBetween(DB::raw('COALESCE(placed_at, created_at)'), [$start, $end])
            ->where('payment_status', 'paid')
            ->whereIn('status', self::VALID_ORDER_STATUSES_FOR_REPORT);
    }
}
