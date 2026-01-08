<?php

namespace App\Services\Reports;

use App\Models\Ecommerce\Order;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class SalesReportService
{
    public const VALID_ORDER_STATUSES_FOR_REPORT = ['paid', 'packed', 'shipped', 'completed'];
    public const VALID_PAYMENT_STATUSES_FOR_REPORT = ['paid', 'refunded'];

    public function getOverview(Carbon $start, Carbon $end): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);
        $profitSupported = $this->profitSupported();

        $ordersCount = (clone $baseQuery)->count();
        $revenue = (float) (clone $baseQuery)->sum('grand_total');
        $itemsCount = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('orders.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('orders.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->sum('order_items.quantity');
        $cogs = $profitSupported ? $this->cogsForOrderItems($start, $end) : null;

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
                'cogs' => $cogs,
                'gross_profit' => $profitSupported && $cogs !== null ? $revenue - $cogs : null,
            ],
            'by_status' => $byStatus,
        ];
    }

    public function getDaily(Carbon $start, Carbon $end, string $groupBy = 'day'): array
    {
        $groupBy = $groupBy === 'month' ? 'month' : 'day';
        $profitSupported = $this->profitSupported();
        $rows = $this->buildDailyRowsQuery($start, $end, $groupBy, $profitSupported)
            ->get()
            ->map(function ($row) use ($profitSupported) {
                $revenue = (float) $row->revenue;
                $cogs = (float) $row->cogs;

                return [
                    'date' => $row->date_bucket,
                    'orders_count' => (int) $row->orders_count,
                    'items_count' => (int) $row->items_count,
                    'revenue' => $revenue,
                    'cogs' => $profitSupported ? $cogs : null,
                    'gross_profit' => $profitSupported ? $revenue - $cogs : null,
                ];
            })
            ->values();

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'totals' => $this->buildTotalsFromRows($rows, $profitSupported),
            'rows' => $rows,
        ];
    }

    public function getDailyDataTable(
        Carbon $start,
        Carbon $end,
        string $groupBy = 'day',
        int $perPage = 15,
        int $page = 1
    ): array
    {
        $groupBy = $groupBy === 'month' ? 'month' : 'day';
        $profitSupported = $this->profitSupported();
        $rowsQuery = $this->buildDailyRowsQuery($start, $end, $groupBy, $profitSupported);

        if ($perPage <= 0) {
            $rowsCollection = $rowsQuery->get();
            $pagination = [
                'total' => $rowsCollection->count(),
                'per_page' => $rowsCollection->count(),
                'current_page' => 1,
                'last_page' => 1,
            ];
        } else {
            $paginator = $rowsQuery->paginate($perPage, ['*'], 'page', $page);
            $rowsCollection = collect($paginator->items());
            $pagination = [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ];
        }

        $rows = $rowsCollection
            ->map(function ($row) use ($profitSupported) {
                $revenue = (float) $row->revenue;
                $cogs = (float) $row->cogs;

                return [
                    'date' => $row->date_bucket,
                    'orders_count' => (int) $row->orders_count,
                    'items_count' => (int) $row->items_count,
                    'revenue' => $revenue,
                    'cogs' => $profitSupported ? $cogs : null,
                    'gross_profit' => $profitSupported ? $revenue - $cogs : null,
                ];
            })
            ->values();

        $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
        $grandTotals = $this->buildDailyGrandTotals($start, $end, $profitSupported);

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'totals_page' => $totalsPage,
            'grand_totals' => $grandTotals,
            'totals' => $grandTotals,
            'rows' => $rows,
            'pagination' => $pagination,
        ];
    }

    public function getByCategory(
        Carbon $start,
        Carbon $end,
        int $perPage = 15,
        int $page = 1,
        int $top = 5
    ): array
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByCategoryQuery($start, $end, $profitSupported);

        $tops = (clone $rowsQuery)
            ->limit(max(1, $top))
            ->get()
            ->map($transformRow)
            ->values();

        if ($perPage <= 0) {
            $rows = $rowsQuery->get()->map($transformRow)->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $rows->count(),
                'per_page' => $rows->count(),
                'current_page' => 1,
                'last_page' => 1,
            ];
        } else {
            $paginator = $rowsQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map($transformRow)
                ->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ];
        }

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'tops' => $tops,
            'totals_page' => $totalsPage,
            'grand_totals' => $this->buildSummary($start, $end, $profitSupported),
            'rows' => $rows,
            'pagination' => $pagination,
        ];
    }

    public function getByProducts(
        Carbon $start,
        Carbon $end,
        int $perPage = 15,
        int $page = 1,
        int $top = 5
    ): array
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByProductsQuery($start, $end, $profitSupported);

        $tops = (clone $rowsQuery)
            ->limit(max(1, $top))
            ->get()
            ->map($transformRow)
            ->values();

        if ($perPage <= 0) {
            $rows = $rowsQuery->get()->map($transformRow)->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $rows->count(),
                'per_page' => $rows->count(),
                'current_page' => 1,
                'last_page' => 1,
            ];
        } else {
            $paginator = $rowsQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map($transformRow)
                ->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ];
        }

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'tops' => $tops,
            'totals_page' => $totalsPage,
            'grand_totals' => $this->buildSummary($start, $end, $profitSupported),
            'rows' => $rows,
            'pagination' => $pagination,
        ];
    }

    public function getByCustomers(
        Carbon $start,
        Carbon $end,
        int $perPage = 15,
        int $page = 1,
        int $top = 5
    ): array
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByCustomersQuery($start, $end, $profitSupported);

        $tops = (clone $rowsQuery)
            ->limit(max(1, $top))
            ->get()
            ->map($transformRow)
            ->values();

        if ($perPage <= 0) {
            $rows = $rowsQuery->get()->map($transformRow)->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $rows->count(),
                'per_page' => $rows->count(),
                'current_page' => 1,
                'last_page' => 1,
            ];
        } else {
            $paginator = $rowsQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map($transformRow)
                ->values();
            $totalsPage = $this->buildTotalsFromRows($rows, $profitSupported);
            $pagination = [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ];
        }

        return [
            'date_range' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'tops' => $tops,
            'totals_page' => $totalsPage,
            'grand_totals' => $this->buildSummary($start, $end, $profitSupported),
            'rows' => $rows,
            'pagination' => $pagination,
        ];
    }

    public function getByCategoryRows(Carbon $start, Carbon $end)
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByCategoryQuery($start, $end, $profitSupported);

        return $rowsQuery->cursor()->map($transformRow);
    }

    public function getByProductsRows(Carbon $start, Carbon $end)
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByProductsQuery($start, $end, $profitSupported);

        return $rowsQuery->cursor()->map($transformRow);
    }

    public function getByCustomersRows(Carbon $start, Carbon $end)
    {
        $profitSupported = $this->profitSupported();
        [$rowsQuery, $transformRow] = $this->buildByCustomersQuery($start, $end, $profitSupported);

        return $rowsQuery->cursor()->map($transformRow);
    }

    private function baseOrdersQuery(Carbon $start, Carbon $end): Builder
    {
        return Order::query()
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('status', self::VALID_ORDER_STATUSES_FOR_REPORT);
    }

    public function profitSupported(): bool
    {
        return DB::getSchemaBuilder()->hasColumn('products', 'cost_price');
    }

    private function cogsForOrderItems(Carbon $start, Carbon $end): float
    {
        return (float) DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->sum(DB::raw('oi.quantity * COALESCE(p.cost_price, 0)'));
    }

    public function missingCostProductsCount(Carbon $start, Carbon $end): int
    {
        if (!$this->profitSupported()) {
            return 0;
        }

        return (int) DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereNull('p.cost_price')
            ->distinct('oi.product_id')
            ->count('oi.product_id');
    }

    private function buildTotalsFromRows($rows, bool $profitSupported): array
    {
        $ordersCount = 0;
        $itemsCount = 0;
        $revenue = 0.0;
        $cogs = 0.0;

        foreach ($rows as $row) {
            $ordersCount += $row['orders_count'] ?? 0;
            $itemsCount += $row['items_count'] ?? 0;
            $revenue += $row['revenue'] ?? 0;
            if ($profitSupported && $row['cogs'] !== null) {
                $cogs += $row['cogs'];
            }
        }

        return [
            'orders_count' => $ordersCount,
            'items_count' => $itemsCount,
            'revenue' => $revenue,
            'average_order_value' => $ordersCount > 0 ? $revenue / $ordersCount : 0.0,
            'cogs' => $profitSupported ? $cogs : null,
            'gross_profit' => $profitSupported ? $revenue - $cogs : null,
        ];
    }

    private function buildDailyGrandTotals(Carbon $start, Carbon $end, bool $profitSupported): array
    {
        $baseQuery = $this->baseOrdersQuery($start, $end);
        $ordersCount = (int) (clone $baseQuery)->count();
        $revenue = (float) (clone $baseQuery)->sum('grand_total');
        $itemsCount = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereBetween(DB::raw('COALESCE(orders.placed_at, orders.created_at)'), [$start, $end])
            ->whereIn('orders.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('orders.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->sum('order_items.quantity');
        $cogs = $profitSupported ? $this->cogsForOrderItems($start, $end) : null;
        $grossProfit = $profitSupported && $cogs !== null ? $revenue - $cogs : null;
        if ($grossProfit !== null) {
            $grossMargin = $revenue > 0 ? ($grossProfit / $revenue) * 100 : 0.0;
        } else {
            $grossMargin = null;
        }

        return [
            'orders_count' => $ordersCount,
            'items_count' => $itemsCount,
            'revenue' => $revenue,
            'average_order_value' => $ordersCount > 0 ? $revenue / $ordersCount : 0.0,
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'gross_margin' => $grossMargin,
        ];
    }

    private function buildSummary(Carbon $start, Carbon $end, bool $profitSupported): array
    {
        $revenue = (float) $this->baseOrdersQuery($start, $end)->sum('grand_total');
        $cogs = $profitSupported ? $this->cogsForOrderItems($start, $end) : null;
        $grossProfit = $profitSupported && $cogs !== null ? $revenue - $cogs : null;
        $grossMargin = $grossProfit !== null && $revenue > 0 ? ($grossProfit / $revenue) * 100 : null;

        return [
            'revenue' => $revenue,
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'gross_margin' => $grossMargin,
        ];
    }

    private function buildByCategoryQuery(Carbon $start, Carbon $end, bool $profitSupported): array
    {
        $rowsQuery = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->join('product_categories as pc', 'pc.product_id', '=', 'p.id')
            ->join('categories as c', 'c.id', '=', 'pc.category_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
            ->groupBy('c.id', 'c.name')
            ->select(
                'c.id as category_id',
                'c.name as category_name',
                DB::raw('COUNT(DISTINCT o.id) as orders_count'),
                DB::raw('SUM(oi.quantity) as items_count'),
                DB::raw('SUM(oi.line_total) as revenue')
            )
            ->orderByDesc('revenue');

        if ($profitSupported) {
            $rowsQuery = $rowsQuery->addSelect(DB::raw('SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs'));
        } else {
            $rowsQuery = $rowsQuery->addSelect(DB::raw('0 as cogs'));
        }

        $transformRow = function ($row) use ($profitSupported) {
            $revenue = (float) $row->revenue;
            $cogs = (float) $row->cogs;

            return [
                'category_id' => (int) $row->category_id,
                'category_name' => $row->category_name,
                'orders_count' => (int) $row->orders_count,
                'items_count' => (int) $row->items_count,
                'revenue' => $revenue,
                'cogs' => $profitSupported ? $cogs : null,
                'gross_profit' => $profitSupported ? $revenue - $cogs : null,
            ];
        };

        return [$rowsQuery, $transformRow];
    }

    private function buildDailyRowsQuery(
        Carbon $start,
        Carbon $end,
        string $groupBy,
        bool $profitSupported
    ) {
        $dateExpression = $groupBy === 'month'
            ? "to_char(COALESCE(placed_at, created_at), 'YYYY-MM')"
            : "to_char(COALESCE(placed_at, created_at), 'YYYY-MM-DD')";

        $itemsSubquery = DB::table('order_items')
            ->select('order_id', DB::raw('SUM(quantity) as items_count'))
            ->groupBy('order_id');

        $rowsQuery = $this->baseOrdersQuery($start, $end)
            ->leftJoinSub($itemsSubquery, 'order_item_sums', 'orders.id', '=', 'order_item_sums.order_id')
            ->selectRaw("{$dateExpression} as date_bucket")
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(order_item_sums.items_count), 0) as items_count')
            ->selectRaw('SUM(grand_total) as revenue');

        if ($profitSupported) {
            $cogsSubquery = DB::table('order_items as oi')
                ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
                ->join('orders as o', 'o.id', '=', 'oi.order_id')
                ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
                ->whereIn('o.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
                ->whereIn('o.status', self::VALID_ORDER_STATUSES_FOR_REPORT)
                ->groupBy('oi.order_id')
                ->select('oi.order_id', DB::raw('SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs'));

            $rowsQuery = $rowsQuery
                ->leftJoinSub($cogsSubquery, 'order_item_cogs', 'orders.id', '=', 'order_item_cogs.order_id')
                ->selectRaw('COALESCE(SUM(order_item_cogs.cogs), 0) as cogs');
        } else {
            $rowsQuery = $rowsQuery->selectRaw('0 as cogs');
        }

        return $rowsQuery
            ->groupBy('date_bucket')
            ->orderBy('date_bucket');
    }

    private function buildByProductsQuery(Carbon $start, Carbon $end, bool $profitSupported): array
    {
        $rowsQuery = DB::table('orders as o')
            ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', self::VALID_PAYMENT_STATUSES_FOR_REPORT)
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
            ->orderByDesc('revenue');

        if ($profitSupported) {
            $rowsQuery = $rowsQuery->addSelect(DB::raw('SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs'));
        } else {
            $rowsQuery = $rowsQuery->addSelect(DB::raw('0 as cogs'));
        }

        $transformRow = function ($row) use ($profitSupported) {
            $revenue = (float) $row->revenue;
            $cogs = (float) $row->cogs;

            return [
                'product_id' => (int) $row->product_id,
                'product_name' => $row->product_name,
                'sku' => $row->sku,
                'orders_count' => (int) $row->orders_count,
                'items_count' => (int) $row->items_count,
                'revenue' => $revenue,
                'cogs' => $profitSupported ? $cogs : null,
                'gross_profit' => $profitSupported ? $revenue - $cogs : null,
            ];
        };

        return [$rowsQuery, $transformRow];
    }

    private function buildByCustomersQuery(Carbon $start, Carbon $end, bool $profitSupported): array
    {
        $itemsSubquery = DB::table('order_items')
            ->select('order_id', DB::raw('SUM(quantity) as items_count'))
            ->groupBy('order_id');

        $rowsQuery = $this->baseOrdersQuery($start, $end)
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
            ->orderByDesc('revenue');

        if ($profitSupported) {
            $cogsSubquery = DB::table('order_items as oi')
                ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
                ->select('oi.order_id', DB::raw('SUM(oi.quantity * COALESCE(p.cost_price, 0)) as cogs'))
                ->groupBy('oi.order_id');

            $rowsQuery = $rowsQuery
                ->leftJoinSub($cogsSubquery, 'order_item_cogs', 'orders.id', '=', 'order_item_cogs.order_id')
                ->addSelect(DB::raw('COALESCE(SUM(order_item_cogs.cogs), 0) as cogs'));
        } else {
            $rowsQuery = $rowsQuery->addSelect(DB::raw('0 as cogs'));
        }

        $transformRow = function ($row) use ($profitSupported) {
            $ordersCount = (int) $row->orders_count;
            $revenue = (float) $row->revenue;
            $cogs = (float) $row->cogs;

            return [
                'customer_id' => (int) $row->customer_id,
                'customer_name' => $row->customer_name,
                'customer_email' => $row->customer_email,
                'orders_count' => $ordersCount,
                'items_count' => (int) $row->items_count,
                'revenue' => $revenue,
                'average_order_value' => $ordersCount > 0 ? $revenue / $ordersCount : 0.0,
                'cogs' => $profitSupported ? $cogs : null,
                'gross_profit' => $profitSupported ? $revenue - $cogs : null,
            ];
        };

        return [$rowsQuery, $transformRow];
    }
}
