<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
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

        $customerSub = DB::table('customer_wishlist_items')
            ->select([
                'product_id',
                DB::raw('COUNT(*) as customer_wishlist_count'),
                DB::raw('MAX(created_at) as customer_last_wishlisted_at'),
            ])
            ->when($dateFrom, fn (Builder $q) => $q->where('created_at', '>=', Carbon::parse($dateFrom)->startOfDay()))
            ->when($dateTo, fn (Builder $q) => $q->where('created_at', '<=', Carbon::parse($dateTo)->endOfDay()))
            ->groupBy('product_id');

        $guestSub = DB::table('guest_wishlist_items')
            ->select([
                'product_id',
                DB::raw('COUNT(*) as guest_wishlist_count'),
                DB::raw('MAX(created_at) as guest_last_wishlisted_at'),
            ])
            ->when($dateFrom, fn (Builder $q) => $q->where('created_at', '>=', Carbon::parse($dateFrom)->startOfDay()))
            ->when($dateTo, fn (Builder $q) => $q->where('created_at', '<=', Carbon::parse($dateTo)->endOfDay()))
            ->groupBy('product_id');

        $coverImageSub = DB::table('product_media as pm')
            ->select([
                'pm.product_id',
                DB::raw("(array_agg(pm.path ORDER BY pm.sort_order ASC, pm.id ASC))[1] as image_url"),
            ])
            ->where('pm.type', '=', 'image')
            ->groupBy('pm.product_id');

        $categorySub = DB::table('product_categories as pc')
            ->join('categories as c', 'c.id', '=', 'pc.category_id')
            ->select([
                'pc.product_id',
                DB::raw("(array_agg(c.name ORDER BY c.name ASC))[1] as category_name"),
            ])
            ->groupBy('pc.product_id');

        $query = DB::table('products as p')
            ->leftJoinSub($customerSub, 'cw', fn ($join) => $join->on('cw.product_id', '=', 'p.id'))
            ->leftJoinSub($guestSub, 'gw', fn ($join) => $join->on('gw.product_id', '=', 'p.id'))
            ->leftJoinSub($coverImageSub, 'img', fn ($join) => $join->on('img.product_id', '=', 'p.id'))
            ->leftJoinSub($categorySub, 'cat', fn ($join) => $join->on('cat.product_id', '=', 'p.id'))
            ->where(function (Builder $subQuery) {
                $subQuery->whereNotNull('cw.product_id')->orWhereNotNull('gw.product_id');
            })
            ->when($search !== '', function (Builder $q) use ($search) {
                $q->where(function (Builder $sq) use ($search) {
                    $sq->where('p.name', 'like', "%{$search}%")
                        ->orWhere('p.sku', 'like', "%{$search}%");
                });
            })
            ->when($categoryId, function (Builder $q) use ($categoryId) {
                $q->whereExists(function (Builder $categoryFilter) use ($categoryId) {
                    $categoryFilter
                        ->select(DB::raw(1))
                        ->from('product_categories as pcf')
                        ->whereColumn('pcf.product_id', 'p.id')
                        ->where('pcf.category_id', (int) $categoryId);
                });
            })
            ->when($stockStatus === 'in_stock', fn (Builder $q) => $q->where('p.stock', '>', 0))
            ->when($stockStatus === 'out_of_stock', fn (Builder $q) => $q->where('p.stock', '<=', 0))
            ->when($productStatus === 'active', fn (Builder $q) => $q->where('p.is_active', true))
            ->when($productStatus === 'inactive', fn (Builder $q) => $q->where('p.is_active', false))
            ->select([
                'p.id as product_id',
                'p.name as product_name',
                'p.sku',
                'img.image_url',
                'p.stock as current_stock',
                'p.low_stock_threshold',
                DB::raw("CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END as product_status"),
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) as customer_wishlist_count'),
                DB::raw('COALESCE(gw.guest_wishlist_count, 0) as guest_wishlist_count'),
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) + COALESCE(gw.guest_wishlist_count, 0) as total_wishlist_count'),
                'cat.category_name',
                DB::raw("GREATEST(COALESCE(cw.customer_last_wishlisted_at, '1970-01-01 00:00:00'), COALESCE(gw.guest_last_wishlisted_at, '1970-01-01 00:00:00')) as last_wishlisted_at"),
            ])
            ->orderByDesc('total_wishlist_count')
            ->orderBy('p.id');

        $summaryBaseQuery = clone $query;

        $summaryTotals = DB::query()
            ->fromSub($summaryBaseQuery, 'wishlist_rows')
            ->selectRaw('COUNT(*) as total_wishlisted_products')
            ->selectRaw('COALESCE(SUM(total_wishlist_count), 0) as total_wishlist_adds')
            ->selectRaw('SUM(CASE WHEN current_stock <= 0 AND total_wishlist_count > 0 THEN 1 ELSE 0 END) as out_of_stock_products_with_demand')
            ->first();

        $topWishlistedProduct = DB::query()
            ->fromSub(clone $query, 'wishlist_rows')
            ->orderByDesc('total_wishlist_count')
            ->orderBy('product_id')
            ->value('product_name');

        $paginator = $query->paginate($perPage)->withQueryString();
        $rows = collect($paginator->items());
        $summary = [
            'total_wishlisted_products' => (int) ($summaryTotals->total_wishlisted_products ?? 0),
            'total_wishlist_adds' => (int) ($summaryTotals->total_wishlist_adds ?? 0),
            'top_wishlisted_product' => $topWishlistedProduct ?: null,
            'out_of_stock_products_with_demand' => (int) ($summaryTotals->out_of_stock_products_with_demand ?? 0),
        ];

        return response()->json([
            'data' => $rows,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'summary' => $summary,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'search' => $search,
                'category_id' => $categoryId,
                'stock_status' => $stockStatus,
                'product_status' => $productStatus,
            ],
        ]);
    }
}
