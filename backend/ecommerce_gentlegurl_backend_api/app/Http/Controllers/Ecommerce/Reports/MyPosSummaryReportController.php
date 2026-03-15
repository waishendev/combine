<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MyPosSummaryReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return $this->buildReport($request, true);
    }

    protected function buildReport(Request $request, bool $restrictToCurrentUser = true): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'created_by_user_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'staff_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $user = $request->user();
        $perPage = (int) ($validated['per_page'] ?? 20);
        $staffId = isset($validated['staff_id']) ? (int) $validated['staff_id'] : null;
        $ownerUserId = $restrictToCurrentUser
            ? (int) $user->id
            : (isset($validated['created_by_user_id'])
                ? (int) $validated['created_by_user_id']
                : (isset($validated['user_id']) ? (int) $validated['user_id'] : null));

        $baseQuery = fn () => $this->applyStaffFilter(
            $this->baseOrderQuery($validated, $ownerUserId),
            $staffId,
        );
        $basePackageQuery = fn () => $this->applyPackageStaffFilter(
            $this->basePackageItemQuery($validated, $ownerUserId),
            $staffId,
        );

        $effectiveLineTotalExpr = $this->effectiveLineTotalExpr();
        $snapshotLineTotalExpr = $this->snapshotLineTotalExpr();
        $commissionRateExpr = $this->commissionRateExpr();

        $ordersCount = (clone $this->baseOrdersScopeQuery($validated, $ownerUserId))
            ->where(function (Builder $query) {
                $query->whereExists(function ($subQuery) {
                    $subQuery->selectRaw('1')
                        ->from('order_items as oi_exists')
                        ->whereColumn('oi_exists.order_id', 'orders.id');
                })->orWhereExists(function ($subQuery) {
                    $subQuery->selectRaw('1')
                        ->from('customer_service_packages as csp_exists')
                        ->whereColumn('csp_exists.purchased_ref_id', 'orders.id')
                        ->where('csp_exists.purchased_from', 'POS');
                });
            })
            ->distinct('orders.id')
            ->count('orders.id');

        $itemsCount = (clone $baseQuery())
            ->count('order_items.id')
            + (clone $basePackageQuery())->count('customer_service_packages.id');

        $itemsWithStaffCount = (clone $baseQuery())
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->distinct('order_items.id')
            ->count('order_items.id')
            + (clone $basePackageQuery())
                ->whereExists(function ($subQuery) {
                    $subQuery->selectRaw('1')
                        ->from('service_package_staff_splits as sps_exists')
                        ->whereColumn('sps_exists.customer_service_package_id', 'customer_service_packages.id');
                })
                ->distinct('customer_service_packages.id')
                ->count('customer_service_packages.id');

        $itemsWithoutStaffCount = max(0, $itemsCount - $itemsWithStaffCount);

        $totalItemAmount = (float) ((clone $baseQuery())
            ->selectRaw("COALESCE(SUM($effectiveLineTotalExpr), 0) AS total_item_amount")
            ->value('total_item_amount') ?? 0);
        $totalItemAmount += (float) ((clone $basePackageQuery())
            ->selectRaw('COALESCE(SUM(COALESCE((SELECT SUM(sps_sum.split_sales_amount) FROM service_package_staff_splits sps_sum WHERE sps_sum.customer_service_package_id = customer_service_packages.id), service_packages.selling_price)), 0) AS total_package_amount')
            ->value('total_package_amount') ?? 0);

        $totalStaffCommission = (float) ((clone $baseQuery())
            ->leftJoin('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->when($staffId, fn (Builder $query) => $query->where('order_item_staff_splits.staff_id', $staffId))
            ->selectRaw("COALESCE(SUM(($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) * ($commissionRateExpr)), 0) AS total_staff_commission")
            ->value('total_staff_commission') ?? 0);
        $totalStaffCommission += (float) ((clone $basePackageQuery())
            ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
            ->when($staffId, fn (Builder $query) => $query->where('service_package_staff_splits.staff_id', $staffId))
            ->selectRaw('COALESCE(SUM(service_package_staff_splits.commission_amount_snapshot), 0) AS total_package_commission')
            ->value('total_package_commission') ?? 0);

        $myCommission = $totalStaffCommission;
        if ($restrictToCurrentUser && $user->staff_id) {
            $myCommission = (float) ((clone $baseQuery())
                ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
                ->where('order_item_staff_splits.staff_id', (int) $user->staff_id)
                ->selectRaw("COALESCE(SUM(($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) * ($commissionRateExpr)), 0) AS my_commission")
                ->value('my_commission') ?? 0);
            $myCommission += (float) ((clone $basePackageQuery())
                ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
                ->where('service_package_staff_splits.staff_id', (int) $user->staff_id)
                ->selectRaw('COALESCE(SUM(service_package_staff_splits.commission_amount_snapshot), 0) AS my_package_commission')
                ->value('my_package_commission') ?? 0);
        }

        $freeMetrics = (clone $baseQuery())
            ->selectRaw('COALESCE(SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN 1 ELSE 0 END), 0) AS free_items_count')
            ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN ($snapshotLineTotalExpr) ELSE 0 END), 0) AS free_items_snapshot_total")
            ->selectRaw("COALESCE(SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN ($effectiveLineTotalExpr) ELSE 0 END), 0) AS free_items_effective_total")
            ->first();

        $freeItemsByProduct = (clone $baseQuery())
            ->where('order_items.is_staff_free_applied', true)
            ->selectRaw('order_items.product_id')
            ->selectRaw('MAX(order_items.product_name_snapshot) AS product_name')
            ->selectRaw('COUNT(*) AS free_items_count')
            ->selectRaw("SUM($snapshotLineTotalExpr) AS free_items_snapshot_total")
            ->selectRaw("SUM($effectiveLineTotalExpr) AS free_items_effective_total")
            ->groupBy('order_items.product_id')
            ->orderByDesc('free_items_snapshot_total')
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id ? (int) $row->product_id : null,
                'product_name' => $row->product_name,
                'free_items_count' => (int) ($row->free_items_count ?? 0),
                'free_items_snapshot_total' => round((float) ($row->free_items_snapshot_total ?? 0), 2),
                'free_items_effective_total' => round((float) ($row->free_items_effective_total ?? 0), 2),
            ])
            ->values();

        $productDetailQuery = (clone $baseQuery())
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw('orders.created_by_user_id AS created_by_user_id')
            ->selectRaw('COALESCE(creator_staff.name, creator_user.name) AS created_by_name')
            ->selectRaw('creator_staff.phone AS created_by_phone')
            ->selectRaw('COALESCE(creator_staff.email, creator_user.email) AS created_by_email')
            ->selectRaw('order_items.id AS order_item_id')
            ->selectRaw("'product' AS item_type")
            ->selectRaw('order_items.product_name_snapshot AS product_name')
            ->selectRaw('order_items.quantity AS qty')
            ->selectRaw("($effectiveLineTotalExpr) AS item_total_price")
            ->selectRaw("($snapshotLineTotalExpr) AS item_snapshot_total")
            ->selectRaw('COALESCE(order_items.is_staff_free_applied, false) AS is_staff_free_applied')
            ->selectRaw('EXISTS (SELECT 1 FROM order_item_staff_splits oiss WHERE oiss.order_item_id = order_items.id) AS has_staff_assignment');

        $packageDetailQuery = (clone $basePackageQuery())
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw('orders.created_by_user_id AS created_by_user_id')
            ->selectRaw('COALESCE(creator_staff.name, creator_user.name) AS created_by_name')
            ->selectRaw('creator_staff.phone AS created_by_phone')
            ->selectRaw('COALESCE(creator_staff.email, creator_user.email) AS created_by_email')
            ->selectRaw('customer_service_packages.id AS order_item_id')
            ->selectRaw("'service_package' AS item_type")
            ->selectRaw('service_packages.name AS product_name')
            ->selectRaw('1 AS qty')
            ->selectRaw('COALESCE((SELECT SUM(sps_amount.split_sales_amount) FROM service_package_staff_splits sps_amount WHERE sps_amount.customer_service_package_id = customer_service_packages.id), service_packages.selling_price) AS item_total_price')
            ->selectRaw('COALESCE((SELECT SUM(sps_amount.split_sales_amount) FROM service_package_staff_splits sps_amount WHERE sps_amount.customer_service_package_id = customer_service_packages.id), service_packages.selling_price) AS item_snapshot_total')
            ->selectRaw('false AS is_staff_free_applied')
            ->selectRaw('EXISTS (SELECT 1 FROM service_package_staff_splits sps WHERE sps.customer_service_package_id = customer_service_packages.id) AS has_staff_assignment');

        $combinedDetailQuery = $productDetailQuery->unionAll($packageDetailQuery);

        $paginator = DB::query()->fromSub($combinedDetailQuery, 'report_rows')
            ->orderByDesc('report_rows.order_date')
            ->orderByDesc('report_rows.order_item_id')
            ->paginate($perPage);

        $productItemIds = collect($paginator->items())
            ->filter(fn ($row) => ($row->item_type ?? 'product') === 'product')
            ->pluck('order_item_id')
            ->map(fn ($v) => (int) $v)
            ->all();
        $packageItemIds = collect($paginator->items())
            ->filter(fn ($row) => ($row->item_type ?? 'product') === 'service_package')
            ->pluck('order_item_id')
            ->map(fn ($v) => (int) $v)
            ->all();

        $splitsGrouped = collect();
        if (! empty($productItemIds)) {
            $productSplitsGrouped = DB::table('order_item_staff_splits')
                ->leftJoin('staffs', 'staffs.id', '=', 'order_item_staff_splits.staff_id')
                ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
                ->whereIn('order_item_staff_splits.order_item_id', $productItemIds)
                ->selectRaw('order_item_staff_splits.order_item_id')
                ->selectRaw('order_item_staff_splits.staff_id')
                ->selectRaw('staffs.name AS staff_name')
                ->selectRaw('order_item_staff_splits.share_percent')
                ->selectRaw('order_item_staff_splits.commission_rate_snapshot')
                ->selectRaw("($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) * ($commissionRateExpr) AS staff_commission_amount")
                ->orderBy('order_item_staff_splits.id')
                ->get()
                ->map(fn ($row) => [
                    'split_key' => sprintf('product:%d', (int) $row->order_item_id),
                    'staff_id' => $row->staff_id ? (int) $row->staff_id : null,
                    'staff_name' => $row->staff_name,
                    'share_percent' => (int) $row->share_percent,
                    'commission_rate_snapshot' => (float) ($row->commission_rate_snapshot ?? 0),
                    'staff_commission_amount' => round((float) $row->staff_commission_amount, 2),
                ])
                ->groupBy('split_key');

            $splitsGrouped = $splitsGrouped->merge($productSplitsGrouped);
        }

        if (! empty($packageItemIds)) {
            $packageSplitsGrouped = DB::table('service_package_staff_splits')
                ->leftJoin('staffs', 'staffs.id', '=', 'service_package_staff_splits.staff_id')
                ->whereIn('service_package_staff_splits.customer_service_package_id', $packageItemIds)
                ->selectRaw('service_package_staff_splits.customer_service_package_id AS order_item_id')
                ->selectRaw('service_package_staff_splits.staff_id')
                ->selectRaw('staffs.name AS staff_name')
                ->selectRaw('service_package_staff_splits.share_percent')
                ->selectRaw('service_package_staff_splits.service_commission_rate_snapshot AS commission_rate_snapshot')
                ->selectRaw('service_package_staff_splits.commission_amount_snapshot AS staff_commission_amount')
                ->orderBy('service_package_staff_splits.id')
                ->get()
                ->map(fn ($row) => [
                    'split_key' => sprintf('service_package:%d', (int) $row->order_item_id),
                    'staff_id' => $row->staff_id ? (int) $row->staff_id : null,
                    'staff_name' => $row->staff_name,
                    'share_percent' => (int) $row->share_percent,
                    'commission_rate_snapshot' => (float) ($row->commission_rate_snapshot ?? 0),
                    'staff_commission_amount' => round((float) $row->staff_commission_amount, 2),
                ])
                ->groupBy('split_key');

            $splitsGrouped = $splitsGrouped->merge($packageSplitsGrouped);
        }

        $details = collect($paginator->items())
            ->map(fn ($row) => [
                'order_no' => $row->order_no,
                'order_id' => (int) $row->order_id,
                'order_date' => $row->order_date,
                'created_by_user_id' => $row->created_by_user_id ? (int) $row->created_by_user_id : null,
                'created_by_name' => $row->created_by_name,
                'created_by_phone' => $row->created_by_phone,
                'created_by_email' => $row->created_by_email,
                'order_item_id' => (int) $row->order_item_id,
                'item_type' => $row->item_type,
                'product_name' => $row->product_name,
                'qty' => (int) $row->qty,
                'item_total_price' => round((float) $row->item_total_price, 2),
                'item_snapshot_total' => round((float) ($row->item_snapshot_total ?? 0), 2),
                'is_staff_free_applied' => (bool) $row->is_staff_free_applied,
                'has_staff_assignment' => (bool) $row->has_staff_assignment,
                'staff_splits' => ($splitsGrouped->get(sprintf('%s:%d', $row->item_type, (int) $row->order_item_id)) ?? collect())
                    ->map(fn ($split) => collect($split)->except('split_key')->all())
                    ->values(),
            ])
            ->values();

        return response()->json([
            'range' => [
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
            ],
            'summary' => [
                'orders_count' => (int) $ordersCount,
                'items_count' => (int) $itemsCount,
                'items_with_staff_count' => (int) $itemsWithStaffCount,
                'items_without_staff_count' => (int) $itemsWithoutStaffCount,
                'total_item_amount' => round($totalItemAmount, 2),
                'total_staff_commission' => round($totalStaffCommission, 2),
                'my_commission' => round($myCommission, 2),
                'free_items_count' => (int) ($freeMetrics->free_items_count ?? 0),
                'free_items_snapshot_total' => round((float) ($freeMetrics->free_items_snapshot_total ?? 0), 2),
                'free_items_effective_total' => round((float) ($freeMetrics->free_items_effective_total ?? 0), 2),
            ],
            'free_items_by_product' => $freeItemsByProduct,
            'data' => $details,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    protected function baseOrderQuery(array $filters, ?int $ownerUserId = null): Builder
    {
        $query = $this->baseOrdersScopeQuery($filters, $ownerUserId)
            ->join('order_items', 'order_items.order_id', '=', 'orders.id');

        return $query;
    }

    protected function baseOrdersScopeQuery(array $filters, ?int $ownerUserId = null): Builder
    {
        $query = DB::table('orders')
            ->leftJoin('users as creator_user', 'creator_user.id', '=', 'orders.created_by_user_id')
            ->leftJoin('staffs as creator_staff', 'creator_staff.id', '=', 'creator_user.staff_id')
            ->whereDate('orders.created_at', '>=', $filters['start_date'])
            ->whereDate('orders.created_at', '<=', $filters['end_date'])
            ->where(function (Builder $query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function (Builder $query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at');

        if ($ownerUserId) {
            $query->where('orders.created_by_user_id', $ownerUserId);
        }

        return $query;
    }

    protected function basePackageItemQuery(array $filters, ?int $ownerUserId = null): Builder
    {
        return $this->baseOrdersScopeQuery($filters, $ownerUserId)
            ->join('customer_service_packages', function ($join) {
                $join->on('customer_service_packages.purchased_ref_id', '=', 'orders.id')
                    ->where('customer_service_packages.purchased_from', 'POS');
            })
            ->join('service_packages', 'service_packages.id', '=', 'customer_service_packages.service_package_id');
    }

    protected function applyStaffFilter(Builder $query, ?int $staffId = null): Builder
    {
        if (! $staffId) {
            return $query;
        }

        return $query->whereExists(function ($subquery) use ($staffId) {
            $subquery->selectRaw('1')
                ->from('order_item_staff_splits as oiss_filter')
                ->whereColumn('oiss_filter.order_item_id', 'order_items.id')
                ->where('oiss_filter.staff_id', $staffId);
        });
    }

    protected function applyPackageStaffFilter(Builder $query, ?int $staffId = null): Builder
    {
        if (! $staffId) {
            return $query;
        }

        return $query->whereExists(function ($subquery) use ($staffId) {
            $subquery->selectRaw('1')
                ->from('service_package_staff_splits as sps_filter')
                ->whereColumn('sps_filter.customer_service_package_id', 'customer_service_packages.id')
                ->where('sps_filter.staff_id', $staffId);
        });
    }

    protected function effectiveLineTotalExpr(): string
    {
        return 'COALESCE(order_items.effective_line_total, order_items.line_total)::numeric';
    }

    protected function snapshotLineTotalExpr(): string
    {
        return 'COALESCE(order_items.line_total_snapshot, order_items.line_total)::numeric';
    }

    protected function commissionRateExpr(): string
    {
        return '(CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END)';
    }
}
