<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Product;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WishlistReportController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min((int) $request->query('per_page', 15), 100));
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->query('category_id');
        $stockStatus = $request->query('stock_status');
        $productStatus = $request->query('product_status');

        $customerSub = $this->wishlistCounts('customer_wishlist_items', 'customer', $dateFrom, $dateTo);
        $guestSub = $this->wishlistCounts('guest_wishlist_items', 'guest', $dateFrom, $dateTo);

        $coverImageSub = DB::table('product_media as pm')
            ->select(['pm.product_id', DB::raw('(array_agg(pm.path ORDER BY pm.sort_order ASC, pm.id ASC))[1] as image_url')])
            ->where('pm.type', 'image')
            ->groupBy('pm.product_id');

        $categorySub = DB::table('product_categories as pc')
            ->join('categories as c', 'c.id', '=', 'pc.category_id')
            ->select(['pc.product_id', DB::raw('(array_agg(c.name ORDER BY c.name ASC))[1] as category_name')])
            ->groupBy('pc.product_id');

        // Wishlist identity is product-level. Stock therefore summarizes all active,
        // purchasable variants rather than treating the product's legacy stock as a variant result.
        $variantAvailable = "CASE
            WHEN v.track_stock = false THEN 1
            WHEN COALESCE(v.is_bundle, false) = true THEN CASE WHEN COALESCE((
                SELECT MIN(FLOOR(component.stock / GREATEST(bundle_item.quantity, 1)))
                FROM product_variant_bundle_items bundle_item
                JOIN product_variants component ON component.id = bundle_item.component_variant_id
                WHERE bundle_item.bundle_variant_id = v.id AND component.track_stock = true
            ), 1) > 0 THEN 1 ELSE 0 END
            WHEN v.stock > 0 THEN 1 ELSE 0 END";

        $variantSub = DB::table('product_variants as v')
            ->selectRaw("v.product_id, COUNT(*) as variant_record_count,
                SUM(CASE WHEN v.is_active = true THEN 1 ELSE 0 END) as variant_count,
                SUM(CASE WHEN v.is_active = true AND ({$variantAvailable}) = 0 THEN 1 ELSE 0 END) as out_of_stock_variant_count")
            ->groupBy('v.product_id');

        $baseQuery = DB::table('products as p')
            ->leftJoinSub($customerSub, 'cw', fn ($join) => $join->on('cw.product_id', '=', 'p.id'))
            ->leftJoinSub($guestSub, 'gw', fn ($join) => $join->on('gw.product_id', '=', 'p.id'))
            ->leftJoinSub($coverImageSub, 'img', fn ($join) => $join->on('img.product_id', '=', 'p.id'))
            ->leftJoinSub($categorySub, 'cat', fn ($join) => $join->on('cat.product_id', '=', 'p.id'))
            ->leftJoinSub($variantSub, 'vs', fn ($join) => $join->on('vs.product_id', '=', 'p.id'))
            ->where(fn (Builder $q) => $q->whereNotNull('cw.product_id')->orWhereNotNull('gw.product_id'))
            ->when($search !== '', function (Builder $q) use ($search) {
                $q->where(fn (Builder $sq) => $sq->where('p.name', 'like', "%{$search}%")
                    ->orWhere('p.cn_name', 'like', "%{$search}%")
                    ->orWhere('p.sku', 'like', "%{$search}%"));
            })
            ->when($categoryId, function (Builder $q) use ($categoryId) {
                $q->whereExists(fn (Builder $filter) => $filter->selectRaw('1')->from('product_categories as pcf')
                    ->whereColumn('pcf.product_id', 'p.id')->where('pcf.category_id', (int) $categoryId));
            })
            ->when($productStatus === 'active', fn (Builder $q) => $q->where('p.is_active', true))
            ->when($productStatus === 'inactive', fn (Builder $q) => $q->where('p.is_active', false))
            ->select([
                'p.id as product_id', 'p.name as product_name', 'p.cn_name as product_cn_name', 'p.sku',
                'img.image_url', 'p.low_stock_threshold', 'cat.category_name',
                DB::raw("CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as product_status"),
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) as customer_wishlist_count'),
                DB::raw('COALESCE(gw.guest_wishlist_count, 0) as guest_wishlist_count'),
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) + COALESCE(gw.guest_wishlist_count, 0) as total_wishlist_count'),
                DB::raw("GREATEST(COALESCE(cw.customer_last_wishlisted_at, '1970-01-01 00:00:00'), COALESCE(gw.guest_last_wishlisted_at, '1970-01-01 00:00:00')) as last_wishlisted_at"),
                DB::raw('CASE WHEN COALESCE(vs.variant_record_count, 0) > 0 THEN true ELSE false END as has_variants'),
                DB::raw('COALESCE(vs.variant_count, 0) as variant_count'),
                DB::raw('COALESCE(vs.out_of_stock_variant_count, 0) as out_of_stock_variant_count'),
                DB::raw('CASE WHEN COALESCE(vs.variant_record_count, 0) > 0 THEN NULL ELSE p.stock END as current_stock'),
                DB::raw("CASE
                    WHEN COALESCE(vs.variant_record_count, 0) = 0 THEN CASE WHEN p.track_stock = false OR p.stock > 0 THEN 'in_stock' ELSE 'out_of_stock' END
                    WHEN COALESCE(vs.variant_count, 0) = 0 OR vs.out_of_stock_variant_count = vs.variant_count THEN 'out_of_stock'
                    WHEN vs.out_of_stock_variant_count > 0 THEN 'partial'
                    ELSE 'in_stock' END as stock_status"),
            ]);

        $query = DB::query()->fromSub($baseQuery, 'wishlist_rows')
            ->when($stockStatus === 'in_stock', fn (Builder $q) => $q->whereIn('stock_status', ['in_stock', 'partial']))
            ->when($stockStatus === 'out_of_stock', fn (Builder $q) => $q->where('stock_status', 'out_of_stock'))
            ->orderByDesc('total_wishlist_count')->orderBy('product_id');

        $summaryTotals = DB::query()->fromSub(clone $query, 'summary_rows')
            ->selectRaw('COUNT(*) as total_wishlisted_products')
            ->selectRaw('COALESCE(SUM(total_wishlist_count), 0) as total_wishlist_adds')
            ->selectRaw("SUM(CASE WHEN stock_status = 'out_of_stock' AND total_wishlist_count > 0 THEN 1 ELSE 0 END) as out_of_stock_products_with_demand")
            ->selectRaw('COALESCE(MAX(total_wishlist_count), 0) as max_wishlist_count')->first();

        $maxCount = (int) ($summaryTotals->max_wishlist_count ?? 0);
        $topProducts = $maxCount > 0
            ? DB::query()->fromSub(clone $query, 'top_rows')->where('total_wishlist_count', $maxCount)
                ->orderBy('product_id')->get(['product_id', 'product_name', 'sku', 'total_wishlist_count', 'last_wishlisted_at'])
            : collect();
        $uniqueTop = $topProducts->count() === 1 ? $topProducts->first() : null;

        $paginator = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => collect($paginator->items()),
            'current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(), 'total' => $paginator->total(),
            'summary' => [
                'total_wishlisted_products' => (int) ($summaryTotals->total_wishlisted_products ?? 0),
                'total_wishlist_adds' => (int) ($summaryTotals->total_wishlist_adds ?? 0),
                'top_wishlisted_product' => $uniqueTop?->product_name,
                'top_wishlist_count' => $maxCount,
                'top_wishlisted_product_count' => $topProducts->count(),
                'top_wishlisted_is_tie' => $topProducts->count() > 1,
                'top_wishlisted_products' => $topProducts->map(fn ($row) => [
                    'product_id' => (int) $row->product_id,
                    'product_name' => (string) $row->product_name,
                    'sku' => $row->sku,
                    'total_wishlist_count' => (int) $row->total_wishlist_count,
                ])->values()->all(),
                'out_of_stock_products_with_demand' => (int) ($summaryTotals->out_of_stock_products_with_demand ?? 0),
            ],
            'filters' => [
                'date_from' => $dateFrom, 'date_to' => $dateTo, 'search' => $search,
                'category_id' => $categoryId, 'stock_status' => $stockStatus, 'product_status' => $productStatus,
            ],
        ]);
    }

    /** Lazy product-level detail; wishlist counts are intentionally absent because wishlist has no variant id. */
    public function inventoryDetail(Product $product)
    {
        $product->load(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')->orderBy('id'), 'variants.bundleItems.componentVariant']);

        abort_if($product->variants->isEmpty(), 404, 'This product has no active variants.');

        return response()->json([
            'product' => ['id' => $product->id, 'name' => $product->name, 'cn_name' => $product->cn_name],
            'variants' => $product->variants->map(function ($variant) {
                $stock = $variant->track_stock ? ($variant->is_bundle ? $variant->derivedAvailableQty() : (int) $variant->stock) : null;

                return [
                    'id' => $variant->id, 'name' => $variant->title, 'cn_name' => $variant->cn_name,
                    'sku' => $variant->sku, 'current_stock' => $stock,
                    'stock_status' => $stock === null || $stock > 0 ? 'in_stock' : 'out_of_stock',
                ];
            })->values(),
            'wishlist_identity' => 'product',
        ]);
    }

    private function wishlistCounts(string $table, string $prefix, mixed $dateFrom, mixed $dateTo): Builder
    {
        return DB::table($table)->select([
            'product_id', DB::raw("COUNT(*) as {$prefix}_wishlist_count"),
            DB::raw("MAX(created_at) as {$prefix}_last_wishlisted_at"),
        ])->when($dateFrom, fn (Builder $q) => $q->where('created_at', '>=', Carbon::parse($dateFrom)->startOfDay()))
            ->when($dateTo, fn (Builder $q) => $q->where('created_at', '<=', Carbon::parse($dateTo)->endOfDay()))
            ->groupBy('product_id');
    }
}
