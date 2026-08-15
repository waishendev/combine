<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\MemoizesSchemaLookups;
use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\Reports\ReportBranchScope;
use App\Services\StoreLocationAccessService;

class DashboardAnalyticsController extends Controller
{
    use MemoizesSchemaLookups;

    private ReportBranchScope $branchScope;

    public function ecommerce(Request $request, StoreLocationAccessService $access)
    {
        $this->branchScope = ReportBranchScope::fromRequest($request, $access);
        $lowStockOnly = $request->boolean('low_stock');
        $missingCostOnly = $request->boolean('missing_cost');
        $status = $request->query('status', 'active');
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category_id');
        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);

        // Build inventory once; clone for summary + detail so Schema lookups and SQL assembly run once.
        $inventoryRows = $this->inventoryRowsQuery();
        $summary = DB::query()->fromSub(clone $inventoryRows, 'i')->selectRaw(
            'COUNT(DISTINCT product_id) as active_count, COUNT(*) as sku_count, SUM(stock) as current_stock_qty, SUM(CASE WHEN cost_price IS NULL THEN 1 ELSE 0 END) as missing_cost_count, SUM(CASE WHEN min_branch_stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count, SUM(stock * COALESCE(cost_price, 0)) as current_cost, SUM(stock * retail_price) as retail_value'
        )->first();

        $grossSales = $this->grossProductSales();
        $refundAmount = $this->ecommerceRefundAmount();

        $categoryAggregate = $this->categoryAggregateExpression();
        $detailQuery = DB::query()->fromSub(clone $inventoryRows, 'i')
            ->leftJoin('product_categories as pc', 'pc.product_id', '=', 'i.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'pc.category_id')
            ->selectRaw("i.*, {$categoryAggregate} as category")
            ->groupBy('i.product_id', 'i.product_name', 'i.product_sku', 'i.product_active', 'i.variant_id', 'i.variant_title', 'i.variant_sku', 'i.stock', 'i.min_branch_stock', 'i.cost_price', 'i.retail_price', 'i.low_stock_threshold');

        if ($status === 'inactive') {
            // Phase 1 primary analytics excludes inactive products; detail table keeps status filter shape for UI.
            $detailQuery->whereRaw('1 = 0');
        }
        if ($search !== '') {
            $detailQuery->where(fn ($q) => $q->where('i.product_name', 'like', "%{$search}%")->orWhere('i.variant_sku', 'like', "%{$search}%")->orWhere('i.variant_title', 'like', "%{$search}%"));
        }
        if (is_numeric($categoryId)) {
            $detailQuery->where('pc.category_id', (int) $categoryId);
        } elseif (is_string($categoryId) && trim($categoryId) !== '') {
            $detailQuery->where('c.name', $categoryId);
        }
        if ($lowStockOnly) {
            $detailQuery->whereRaw('i.min_branch_stock <= i.low_stock_threshold');
        }
        if ($missingCostOnly) {
            $detailQuery->whereNull('i.cost_price');
        }

        $rows = $detailQuery->orderBy('i.product_name')->paginate($perPage);
        $breakdowns = $this->branchInventoryBreakdowns(collect($rows->items()));
        $rows->through(function ($row) use ($breakdowns) {
            $stock = (int) $row->stock;
            $cost = (float) ($row->cost_price ?? 0);
            $retail = (float) $row->retail_price;
            return [
                'product_id' => (int) $row->product_id,
                'product' => $row->product_name,
                'sku_variant' => $row->variant_title ? trim($row->variant_sku.' / '.$row->variant_title, ' /') : ($row->variant_sku ?: $row->product_sku),
                'category' => $row->category ?: 'Uncategorized',
                'status' => $row->product_active ? 'Active' : 'Inactive',
                'current_stock' => $stock,
                'has_branch_low_stock' => (int) $row->min_branch_stock <= (int) $row->low_stock_threshold,
                'branch_inventory_breakdown' => $breakdowns[$this->inventoryKey($row->product_id, $row->variant_id)] ?? [],
                'low_branches' => collect($breakdowns[$this->inventoryKey($row->product_id, $row->variant_id)] ?? [])->where('is_low', true)->values()->all(),
                'cost_per_unit' => $row->cost_price === null ? null : $cost,
                'retail_price' => $retail,
                'inventory_cost' => $stock * $cost,
                'retail_value' => $stock * $retail,
                'potential_profit' => ($stock * $retail) - ($stock * $cost),
                'missing_cost' => $row->cost_price === null,
            ];
        });

        $currentCost = (float) ($summary->current_cost ?? 0);
        $retailValue = (float) ($summary->retail_value ?? 0);
        $profit = $retailValue - $currentCost;

        return response()->json([
            'products' => [
                'active_count' => (int) ($summary->active_count ?? 0),
                'sku_count' => (int) ($summary->sku_count ?? 0),
                'current_stock_qty' => (int) ($summary->current_stock_qty ?? 0),
                'missing_cost_count' => (int) ($summary->missing_cost_count ?? 0),
                'low_stock_count' => (int) ($summary->low_stock_count ?? 0),
            ],
            'inventory' => [
                'current_cost' => round($currentCost, 2),
                'retail_value' => round($retailValue, 2),
                'potential_gross_profit' => round($profit, 2),
                'potential_margin_percent' => $retailValue > 0 ? round(($profit / $retailValue) * 100, 2) : 0,
            ],
            'sales' => [
                'gross_product_sales' => round($grossSales, 2),
                'refund_amount' => round($refundAmount, 2),
                'refund_available' => $this->refundsAreAvailable(),
                'net_product_sales' => round($grossSales - $refundAmount, 2),
            ],
            'items' => $rows,
        ]);
    }

    private function inventoryRowsQuery(): Builder
    {
        $singleRows = $this->singleProductRowsQuery();

        if (! $this->schemaHasTable('product_variants')) {
            return $singleRows;
        }

        return $this->variantRowsQuery()->unionAll($singleRows);
    }

    private function variantRowsQuery(): Builder
    {
        $variantCost = $this->columnExpression('v', 'product_variants', 'cost_price', 'NULL');
        $variantPrice = $this->priceExpression('v', 'product_variants', 'p', 'products');
        $variantLowStock = $this->columnExpression('v', 'product_variants', 'low_stock_threshold', $this->columnExpression('p', 'products', 'low_stock_threshold', '0'));

        return DB::table('product_variants as v')
            ->join('products as p', 'p.id', '=', 'v.product_id')
            ->join('store_location_product as availability', fn ($join) => $join->on('availability.product_id', '=', 'p.id')->where('availability.is_available', true)->whereIn('availability.store_location_id', $this->branchScope->storeLocationIds))
            ->leftJoin('store_location_product_inventories as branch_inventory', fn ($join) => $join
                ->on('branch_inventory.product_id', '=', 'p.id')
                ->on('branch_inventory.product_variant_id', '=', 'v.id')
                ->on('branch_inventory.store_location_id', '=', 'availability.store_location_id'))
            ->selectRaw("p.id as product_id, p.name as product_name, p.sku as product_sku, p.is_active as product_active, v.id as variant_id, v.title as variant_title, v.sku as variant_sku, SUM(COALESCE(branch_inventory.quantity, 0)) as stock, MIN(COALESCE(branch_inventory.quantity, 0)) as min_branch_stock, {$variantCost} as cost_price, {$variantPrice} as retail_price, COALESCE({$variantLowStock}, 0) as low_stock_threshold")
            ->where('p.is_active', true)
            ->where('v.is_active', true)
            ->groupBy('p.id', 'p.name', 'p.sku', 'p.is_active', 'v.id', 'v.title', 'v.sku', 'v.cost_price', 'v.price', 'v.sale_price', 'v.low_stock_threshold', 'p.cost_price', 'p.price', 'p.sale_price', 'p.low_stock_threshold');
    }

    private function singleProductRowsQuery(): Builder
    {
        $productCost = $this->columnExpression('p', 'products', 'cost_price', 'NULL');
        $productPrice = $this->priceExpression('p', 'products');
        $productLowStock = $this->columnExpression('p', 'products', 'low_stock_threshold', '0');

        $query = DB::table('products as p')
            ->join('store_location_product as availability', fn ($join) => $join->on('availability.product_id', '=', 'p.id')->where('availability.is_available', true)->whereIn('availability.store_location_id', $this->branchScope->storeLocationIds))
            ->leftJoin('store_location_product_inventories as branch_inventory', fn ($join) => $join
                ->on('branch_inventory.product_id', '=', 'p.id')
                ->on('branch_inventory.store_location_id', '=', 'availability.store_location_id')
                ->whereNull('branch_inventory.product_variant_id'))
            ->selectRaw("p.id as product_id, p.name as product_name, p.sku as product_sku, p.is_active as product_active, null as variant_id, null as variant_title, p.sku as variant_sku, SUM(COALESCE(branch_inventory.quantity, 0)) as stock, MIN(COALESCE(branch_inventory.quantity, 0)) as min_branch_stock, {$productCost} as cost_price, {$productPrice} as retail_price, COALESCE({$productLowStock}, 0) as low_stock_threshold")
            ->where('p.is_active', true);

        if ($this->schemaHasTable('product_variants')) {
            $query->leftJoin('product_variants as any_v', 'any_v.product_id', '=', 'p.id')
                ->whereNull('any_v.id');
        }

        return $query->groupBy('p.id', 'p.name', 'p.sku', 'p.is_active', 'p.cost_price', 'p.price', 'p.sale_price', 'p.low_stock_threshold');
    }

    private function inventoryKey(int $productId, mixed $variantId): string
    {
        return $productId.':'.($variantId === null ? 'single' : (int) $variantId);
    }

    /** Build one authorized per-branch query for the current page; missing inventory rows are zero. */
    private function branchInventoryBreakdowns($rows): array
    {
        if ($rows->isEmpty()) {
            return [];
        }

        $productIds = $rows->pluck('product_id')->map(fn ($id) => (int) $id)->unique()->all();
        $pairs = DB::table('store_location_product as availability')
            ->join('store_locations as branch', 'branch.id', '=', 'availability.store_location_id')
            ->join('products as p', 'p.id', '=', 'availability.product_id')
            ->leftJoin('product_variants as v', fn ($join) => $join->on('v.product_id', '=', 'p.id')->where('v.is_active', true))
            ->leftJoin('store_location_product_inventories as inventory', fn ($join) => $join
                ->on('inventory.product_id', '=', 'p.id')
                ->on('inventory.store_location_id', '=', 'availability.store_location_id')
                ->whereRaw('((v.id IS NULL AND inventory.product_variant_id IS NULL) OR inventory.product_variant_id = v.id)'))
            ->where('availability.is_available', true)
            ->whereIn('availability.store_location_id', $this->branchScope->storeLocationIds)
            ->whereIn('p.id', $productIds)
            ->selectRaw('p.id as product_id, v.id as variant_id, branch.id as store_location_id, branch.name as branch_name, COALESCE(inventory.quantity, 0) as quantity, COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0) as threshold')
            ->get();

        return $pairs->groupBy(fn ($row) => $this->inventoryKey((int) $row->product_id, $row->variant_id))
            ->map(fn ($group) => $group->map(fn ($row) => [
                'store_location_id' => (int) $row->store_location_id,
                'branch_name' => (string) $row->branch_name,
                'quantity' => (int) $row->quantity,
                'is_low' => (int) $row->quantity <= (int) $row->threshold,
            ])->values()->all())->all();
    }

    private function grossProductSales(): float
    {
        $lineTotal = $this->firstExistingColumnExpression('oi', 'order_items', [
            'effective_line_total',
            'line_total_snapshot',
            'line_total',
        ], '0');

        return (float) $this->branchScope->apply(DB::table('order_items as oi'), 'o.store_location_id')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->where('oi.is_package', false)
            ->whereIn('o.payment_status', ['paid', 'completed', 'refunded', 'partially_refunded'])
            ->whereNotIn('o.status', ['cancelled', 'voided'])
            ->selectRaw("SUM(COALESCE({$lineTotal}, 0)) as total")
            ->value('total');
    }

    private function ecommerceRefundAmount(): float
    {
        if ($this->schemaHasColumn('orders', 'refund_total')) {
            return (float) $this->branchScope->apply(DB::table('orders'), 'orders.store_location_id')
                ->whereIn('payment_status', ['paid', 'completed', 'refunded', 'partially_refunded'])
                ->whereNotIn('status', ['cancelled', 'voided'])
                ->selectRaw('SUM(COALESCE(refund_total, 0)) as total')
                ->value('total');
        }

        if ($this->schemaHasTable('return_requests') && $this->schemaHasColumn('return_requests', 'refund_amount')) {
            return (float) $this->branchScope->apply(DB::table('return_requests as rr'), 'o.store_location_id')
                ->join('orders as o', 'o.id', '=', 'rr.order_id')
                ->whereIn('o.payment_status', ['paid', 'completed', 'refunded', 'partially_refunded'])
                ->whereNotIn('o.status', ['cancelled', 'voided'])
                ->selectRaw('SUM(COALESCE(rr.refund_amount, 0)) as total')
                ->value('total');
        }

        return 0.0;
    }

    private function refundsAreAvailable(): bool
    {
        return $this->schemaHasColumn('orders', 'refund_total')
            || ($this->schemaHasTable('return_requests') && $this->schemaHasColumn('return_requests', 'refund_amount'));
    }

    private function categoryAggregateExpression(): string
    {
        return DB::connection()->getDriverName() === 'pgsql'
            ? "STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name)"
            : 'GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ", ")';
    }

    private function priceExpression(string $alias, string $table, ?string $fallbackAlias = null, ?string $fallbackTable = null): string
    {
        $columns = [];
        if ($this->schemaHasColumn($table, 'sale_price')) {
            $columns[] = "{$alias}.sale_price";
        }
        if ($this->schemaHasColumn($table, 'price')) {
            $columns[] = "{$alias}.price";
        }
        if ($fallbackAlias && $fallbackTable) {
            if ($this->schemaHasColumn($fallbackTable, 'sale_price')) {
                $columns[] = "{$fallbackAlias}.sale_price";
            }
            if ($this->schemaHasColumn($fallbackTable, 'price')) {
                $columns[] = "{$fallbackAlias}.price";
            }
        }
        $columns[] = '0';

        return 'COALESCE('.implode(', ', $columns).')';
    }

    private function columnExpression(string $alias, string $table, string $column, string $fallback): string
    {
        return $this->schemaHasColumn($table, $column) ? "{$alias}.{$column}" : $fallback;
    }

    private function firstExistingColumnExpression(string $alias, string $table, array $columns, string $fallback): string
    {
        foreach ($columns as $column) {
            if ($this->schemaHasColumn($table, $column)) {
                return "{$alias}.{$column}";
            }
        }

        return $fallback;
    }
}
