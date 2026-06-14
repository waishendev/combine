<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductProfitReportController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'min:1'],
            'staff_id' => ['nullable', 'integer', 'min:1'],
            'channel' => ['nullable', 'string', 'in:online,pos'],
            'product_id' => ['nullable', 'integer', 'min:1'],
            'product_variant_id' => ['nullable', 'integer', 'min:1'],
            'include_details' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        [$start, $end, $defaultRangeApplied] = $this->resolveDateRange($request);
        $perPage = max(1, min((int) ($validated['per_page'] ?? 15), 100));
        $page = max(1, (int) ($validated['page'] ?? 1));
        $search = trim((string) ($validated['search'] ?? ''));
        $categoryId = isset($validated['category_id']) ? (int) $validated['category_id'] : null;
        $staffId = isset($validated['staff_id']) ? (int) $validated['staff_id'] : null;
        $channel = (string) ($validated['channel'] ?? '');

        $baseItems = $this->baseProductItemsQuery($start, $end, $search, $categoryId, $staffId, $channel);
        $rowsQuery = (clone $baseItems)
            ->groupBy(
                'oi.product_id',
                'oi.product_variant_id',
                'oi.product_name_snapshot',
                'oi.sku_snapshot',
                'oi.variant_name_snapshot',
                'oi.variant_sku_snapshot'
            )
            ->select([
                'oi.product_id',
                'oi.product_variant_id',
                'oi.product_name_snapshot as product_name',
                DB::raw('MAX(p.cn_name) as product_cn_name'),
                'oi.sku_snapshot as product_sku',
                'oi.variant_name_snapshot as variant_name',
                DB::raw('MAX(pv.cn_name) as variant_cn_name'),
                'oi.variant_sku_snapshot as variant_sku',
                DB::raw('SUM(oi.quantity) as quantity_sold'),
                DB::raw('COALESCE(SUM(oi.line_total), 0) as sales_amount'),
                DB::raw('COALESCE(SUM(COALESCE(oi.cost_amount_snapshot, 0)), 0) as cost_amount'),
                DB::raw('COALESCE(SUM(oi.line_total - COALESCE(oi.cost_amount_snapshot, 0)), 0) as gross_profit'),
                DB::raw('COUNT(DISTINCT o.id) as orders_count'),
                DB::raw('SUM(CASE WHEN oi.cost_amount_snapshot IS NULL THEN 1 ELSE 0 END) as missing_cost_items_count'),
            ])
            ->orderByDesc('gross_profit')
            ->orderByDesc('sales_amount');

        $paginator = $rowsQuery->paginate($perPage, ['*'], 'page', $page);
        $rows = collect($paginator->items())->map(fn ($row) => $this->transformSummaryRow($row))->values();

        $summaryRaw = (clone $baseItems)
            ->select([
                DB::raw('COALESCE(SUM(oi.line_total), 0) as total_sales'),
                DB::raw('COALESCE(SUM(COALESCE(oi.cost_amount_snapshot, 0)), 0) as total_cost'),
                DB::raw('COALESCE(SUM(oi.line_total - COALESCE(oi.cost_amount_snapshot, 0)), 0) as gross_profit'),
                DB::raw('COALESCE(SUM(oi.quantity), 0) as quantity_sold'),
                DB::raw('COUNT(DISTINCT o.id) as orders_count'),
                DB::raw('SUM(CASE WHEN oi.cost_amount_snapshot IS NULL THEN 1 ELSE 0 END) as missing_cost_items_count'),
            ])
            ->first();

        $totalSales = (float) ($summaryRaw->total_sales ?? 0);
        $grossProfit = (float) ($summaryRaw->gross_profit ?? 0);
        $response = [
            'data' => $rows,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'summary' => [
                'total_sales' => $totalSales,
                'total_cost' => (float) ($summaryRaw->total_cost ?? 0),
                'gross_profit' => $grossProfit,
                'profit_margin' => $totalSales > 0 ? ($grossProfit / $totalSales) * 100 : 0,
                'quantity_sold' => (int) ($summaryRaw->quantity_sold ?? 0),
                'orders_count' => (int) ($summaryRaw->orders_count ?? 0),
                'missing_cost_items_count' => (int) ($summaryRaw->missing_cost_items_count ?? 0),
            ],
            'filters' => [
                'date_from' => $start->toDateString(),
                'date_to' => $end->toDateString(),
                'search' => $search,
                'category_id' => $categoryId,
                'staff_id' => $staffId,
                'channel' => $channel ?: null,
            ],
            'meta' => [
                'default_range_applied' => $defaultRangeApplied,
                'valid_statuses' => SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT,
                'valid_payment_statuses' => SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT,
                'timestamp_field' => 'placed_at_or_created_at',
                'costing' => 'order_items.cost_amount_snapshot_only',
            ],
        ];

        if ($request->boolean('include_details') && isset($validated['product_id'])) {
            $response['details'] = $this->detailRows(
                $start,
                $end,
                (int) $validated['product_id'],
                isset($validated['product_variant_id']) ? (int) $validated['product_variant_id'] : null,
                $search,
                $categoryId,
                $staffId,
                $channel
            );
        }

        return response()->json($response);
    }

    private function resolveDateRange(Request $request): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');
        $defaultRangeApplied = ! ($hasDateFrom && $hasDateTo);

        if ($defaultRangeApplied) {
            $today = Carbon::today();
            return [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()->endOfDay(), true];
        }

        return [
            Carbon::parse($request->query('date_from'))->startOfDay(),
            Carbon::parse($request->query('date_to'))->endOfDay(),
            false,
        ];
    }

    private function baseProductItemsQuery(
        Carbon $start,
        Carbon $end,
        string $search,
        ?int $categoryId,
        ?int $staffId,
        string $channel
    ): Builder {
        return DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->leftJoin('products as p', 'p.id', '=', 'oi.product_id')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'oi.product_variant_id')
            ->whereBetween(DB::raw('COALESCE(o.placed_at, o.created_at)'), [$start, $end])
            ->whereIn('o.payment_status', SalesReportService::VALID_PAYMENT_STATUSES_FOR_REPORT)
            ->whereIn('o.status', SalesReportService::VALID_ORDER_STATUSES_FOR_REPORT)
            ->whereNotNull('oi.product_id')
            ->where(function (Builder $query) {
                $query->whereNull('oi.line_type')->orWhere('oi.line_type', 'product');
            })
            ->when($search !== '', function (Builder $query) use ($search) {
                $query->where(function (Builder $subQuery) use ($search) {
                    $subQuery->where('oi.product_name_snapshot', 'like', "%{$search}%")
                        ->orWhere('oi.sku_snapshot', 'like', "%{$search}%")
                        ->orWhere('oi.variant_name_snapshot', 'like', "%{$search}%")
                        ->orWhere('oi.variant_sku_snapshot', 'like', "%{$search}%")
                        ->orWhere('p.cn_name', 'like', "%{$search}%")
                        ->orWhere('pv.cn_name', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, function (Builder $query) use ($categoryId) {
                $query->whereExists(function (Builder $categoryQuery) use ($categoryId) {
                    $categoryQuery->select(DB::raw(1))
                        ->from('product_categories as pc')
                        ->whereColumn('pc.product_id', 'oi.product_id')
                        ->where('pc.category_id', $categoryId);
                });
            })
            ->when($staffId, function (Builder $query) use ($staffId) {
                $query->whereExists(function (Builder $staffQuery) use ($staffId) {
                    $staffQuery->select(DB::raw(1))
                        ->from('order_item_staff_splits as oiss')
                        ->whereColumn('oiss.order_item_id', 'oi.id')
                        ->where('oiss.staff_id', $staffId);
                });
            })
            ->when($channel === 'pos', fn (Builder $query) => $query->whereNotNull('o.created_by_user_id'))
            ->when($channel === 'online', fn (Builder $query) => $query->whereNull('o.created_by_user_id'));
    }

    private function transformSummaryRow(object $row): array
    {
        $salesAmount = (float) $row->sales_amount;
        $grossProfit = (float) $row->gross_profit;

        return [
            'product_id' => (int) $row->product_id,
            'product_variant_id' => $row->product_variant_id ? (int) $row->product_variant_id : null,
            'product_name' => (string) $row->product_name,
            'product_cn_name' => $row->product_cn_name ?? null,
            'variant_name' => $row->variant_name,
            'variant_cn_name' => $row->variant_cn_name ?? null,
            'sku' => $row->variant_sku ?: $row->product_sku,
            'product_sku' => $row->product_sku,
            'variant_sku' => $row->variant_sku,
            'quantity_sold' => (int) $row->quantity_sold,
            'sales_amount' => $salesAmount,
            'cost_amount' => (float) $row->cost_amount,
            'gross_profit' => $grossProfit,
            'profit_margin' => $salesAmount > 0 ? ($grossProfit / $salesAmount) * 100 : 0,
            'orders_count' => (int) $row->orders_count,
            'missing_cost_items_count' => (int) $row->missing_cost_items_count,
        ];
    }

    private function detailRows(
        Carbon $start,
        Carbon $end,
        int $productId,
        ?int $productVariantId,
        string $search,
        ?int $categoryId,
        ?int $staffId,
        string $channel
    ) {
        return $this->baseProductItemsQuery($start, $end, $search, $categoryId, $staffId, $channel)
            ->where('oi.product_id', $productId)
            ->when($productVariantId, fn (Builder $query) => $query->where('oi.product_variant_id', $productVariantId))
            ->when($productVariantId === null, fn (Builder $query) => $query->whereNull('oi.product_variant_id'))
            ->orderByDesc(DB::raw('COALESCE(o.placed_at, o.created_at)'))
            ->limit(100)
            ->get([
                'oi.id as order_item_id',
                'o.id as order_id',
                'o.order_number',
                DB::raw('COALESCE(o.placed_at, o.created_at) as ordered_at'),
                'oi.quantity',
                'oi.price_snapshot as sale_price',
                'oi.cost_price_snapshot',
                'oi.line_total',
                DB::raw('COALESCE(oi.cost_amount_snapshot, 0) as cost_amount'),
                DB::raw('oi.line_total - COALESCE(oi.cost_amount_snapshot, 0) as gross_profit'),
                DB::raw('CASE WHEN oi.cost_amount_snapshot IS NULL THEN true ELSE false END as missing_cost'),
            ])
            ->map(fn ($row) => [
                'order_item_id' => (int) $row->order_item_id,
                'order_id' => (int) $row->order_id,
                'order_number' => $row->order_number,
                'ordered_at' => $row->ordered_at,
                'quantity' => (int) $row->quantity,
                'sale_price' => (float) $row->sale_price,
                'cost_price_snapshot' => $row->cost_price_snapshot !== null ? (float) $row->cost_price_snapshot : null,
                'line_total' => (float) $row->line_total,
                'cost_amount' => (float) $row->cost_amount,
                'gross_profit' => (float) $row->gross_profit,
                'missing_cost' => (bool) $row->missing_cost,
            ])
            ->values();
    }
}
