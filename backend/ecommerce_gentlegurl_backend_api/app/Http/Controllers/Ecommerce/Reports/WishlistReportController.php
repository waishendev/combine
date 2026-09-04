<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use App\Services\Ecommerce\WishlistReportSemantics;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WishlistReportController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min((int) $request->query('per_page', 15), 100));
        $query = $this->reportQuery($request);

        // One filtered aggregate result drives every card, including all co-leaders.
        $summaryRows = (clone $query)->get(['p.id', 'p.name', 'p.stock', 'p.track_stock', 'pvc.variant_count', 'pvc.unavailable_variant_count',
            DB::raw('COALESCE(cw.customer_wishlist_count, 0) + COALESCE(gw.guest_wishlist_count, 0) as total_wishlist_count')]);
        $summaryRows->transform(fn ($row) => $this->decorate($row));
        $top = WishlistReportSemantics::topWishlist($summaryRows->map(fn ($row) => [
            'name' => $row->name,
            'count' => $row->total_wishlist_count,
        ])->all());

        $paginator = $query->paginate($perPage)->withQueryString();
        $rows = collect($paginator->items())->map(fn ($row) => $this->decorate($row));

        return response()->json([
            'data' => $rows,
            'current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(), 'total' => $paginator->total(),
            'summary' => [
                'total_wishlisted_products' => $summaryRows->count(),
                'total_wishlist_adds' => (int) $summaryRows->sum('total_wishlist_count'),
                'top_wishlist' => $top,
                'out_of_stock_products_with_demand' => $summaryRows->where('stock_status_code', 'out_of_stock')->count(),
            ],
            'filters' => $this->filters($request),
        ]);
    }

    public function detail(Request $request, int $product)
    {
        $row = $this->reportQuery($request)->where('p.id', $product)->first();
        abort_unless($row, 404, 'No wishlist demand was found for this product and filter scope.');
        $row = $this->decorate($row);

        $variants = DB::table('product_variants')
            ->where('product_id', $product)
            ->orderBy('sort_order')->orderBy('id')
            ->get(['id', 'title', 'cn_name', 'sku', 'stock', 'track_stock', 'is_active'])
            ->map(fn ($variant) => [
                'variant_id' => (int) $variant->id,
                'variant_name' => $variant->title,
                'variant_cn_name' => $variant->cn_name,
                'sku' => $variant->sku,
                // Wishlist tables have no variant identity: never allocate product demand here.
                'wishlist_count' => null, 'customer_wishlist_count' => null, 'guest_wishlist_count' => null,
                'last_wishlisted_at' => null,
                'current_stock' => $variant->track_stock ? (int) $variant->stock : null,
                'availability' => ! $variant->is_active ? 'Inactive' : ((! $variant->track_stock || (int) $variant->stock > 0) ? 'In stock' : 'Out of stock'),
                'is_active' => (bool) $variant->is_active,
            ]);

        return response()->json(['data' => ['product' => $row, 'wishlist_identity' => 'product', 'variants' => $variants]]);
    }

    private function reportQuery(Request $request): Builder
    {
        $filters = $this->filters($request);
        $wishlistSub = function (string $table, string $prefix) use ($filters) {
            return DB::table($table)->select('product_id')
                ->selectRaw("COUNT(*) as {$prefix}_wishlist_count")
                ->selectRaw("MAX(created_at) as {$prefix}_last_wishlisted_at")
                ->when($filters['date_from'], fn (Builder $q, $date) => $q->where('created_at', '>=', Carbon::parse($date)->startOfDay()))
                ->when($filters['date_to'], fn (Builder $q, $date) => $q->where('created_at', '<=', Carbon::parse($date)->endOfDay()))
                ->groupBy('product_id');
        };
        $customer = $wishlistSub('customer_wishlist_items', 'customer');
        $guest = $wishlistSub('guest_wishlist_items', 'guest');
        // Only active variants are relevant ecommerce purchase choices. Untracked stock is available.
        $variants = DB::table('product_variants')->select('product_id')
            ->selectRaw('COUNT(*) FILTER (WHERE is_active = true) as variant_count')
            ->selectRaw('COUNT(*) FILTER (WHERE is_active = true AND track_stock = true AND stock <= 0) as unavailable_variant_count')
            ->groupBy('product_id');
        $images = DB::table('product_media')->select('product_id')->selectRaw("(array_agg(path ORDER BY sort_order, id))[1] as image_url")->where('type', 'image')->groupBy('product_id');
        $categories = DB::table('product_categories as pc')->join('categories as c', 'c.id', 'pc.category_id')->select('pc.product_id')->selectRaw('(array_agg(c.name ORDER BY c.name))[1] as category_name')->groupBy('pc.product_id');

        return DB::table('products as p')
            ->leftJoinSub($customer, 'cw', fn ($j) => $j->on('cw.product_id', 'p.id'))
            ->leftJoinSub($guest, 'gw', fn ($j) => $j->on('gw.product_id', 'p.id'))
            ->leftJoinSub($variants, 'pvc', fn ($j) => $j->on('pvc.product_id', 'p.id'))
            ->leftJoinSub($images, 'img', fn ($j) => $j->on('img.product_id', 'p.id'))
            ->leftJoinSub($categories, 'cat', fn ($j) => $j->on('cat.product_id', 'p.id'))
            ->where(fn (Builder $q) => $q->whereNotNull('cw.product_id')->orWhereNotNull('gw.product_id'))
            ->when($filters['search'], fn (Builder $q, $search) => $q->where(fn (Builder $sq) => $sq->where('p.name', 'like', "%{$search}%")->orWhere('p.cn_name', 'like', "%{$search}%")->orWhere('p.sku', 'like', "%{$search}%")))
            ->select(['p.id as product_id', 'p.name as product_name', 'p.name', 'p.cn_name as product_cn_name', 'p.sku', 'p.stock', 'p.track_stock', 'p.is_active', 'img.image_url', 'cat.category_name', 'pvc.variant_count', 'pvc.unavailable_variant_count',
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) as customer_wishlist_count'), DB::raw('COALESCE(gw.guest_wishlist_count, 0) as guest_wishlist_count'),
                DB::raw('COALESCE(cw.customer_wishlist_count, 0) + COALESCE(gw.guest_wishlist_count, 0) as total_wishlist_count'),
                DB::raw("GREATEST(COALESCE(cw.customer_last_wishlisted_at, '1970-01-01'), COALESCE(gw.guest_last_wishlisted_at, '1970-01-01')) as last_wishlisted_at")])
            ->orderByDesc('total_wishlist_count')->orderBy('p.id');
    }

    private function decorate(object $row): object
    {
        $row->customer_wishlist_count = (int) ($row->customer_wishlist_count ?? 0);
        $row->guest_wishlist_count = (int) ($row->guest_wishlist_count ?? 0);
        $row->total_wishlist_count = (int) ($row->total_wishlist_count ?? 0);
        $row->product_status = $row->is_active ? 'active' : 'inactive';
        $row->current_stock = (int) ($row->stock ?? 0);
        $status = WishlistReportSemantics::stockStatus((int) ($row->stock ?? 0), (bool) $row->track_stock, (int) ($row->variant_count ?? 0), (int) ($row->unavailable_variant_count ?? 0));
        $row->stock_status_code = $status['code']; $row->stock_status = $status['label'];
        $recommendation = WishlistReportSemantics::recommendation($row->total_wishlist_count, $status['code']);
        $row->recommendation = $recommendation['label']; $row->recommendation_detail = $recommendation['detail'];
        return $row;
    }

    private function filters(Request $request): array
    {
        return ['date_from' => $request->query('date_from'), 'date_to' => $request->query('date_to'), 'search' => trim((string) $request->query('search', ''))];
    }
}
