<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffCommissionReportController extends Controller
{
    public function summary(Request $request)
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
        ]);

        $effectiveLineTotalExpr = $this->effectiveLineTotalExpr();
        $snapshotLineTotalExpr = $this->snapshotLineTotalExpr();
        $commissionRateExpr = $this->commissionRateExpr();

        $productRows = $this->baseCommissionQuery($validated)
            ->selectRaw('order_item_staff_splits.staff_id')
            ->selectRaw('MAX(staffs.name) AS staff_name')
            ->selectRaw('MAX(staffs.commission_rate) AS commission_rate')
            ->selectRaw('MAX(staffs.service_commission_rate) AS service_commission_rate')
            ->selectRaw("SUM(($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100)) AS total_sales")
            ->selectRaw("SUM(($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) * ($commissionRateExpr)) AS total_commission")
            ->selectRaw('COUNT(DISTINCT orders.id) AS orders_count')
            ->selectRaw('COUNT(DISTINCT order_items.id) AS items_count')
            ->selectRaw('SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN 1 ELSE 0 END) AS free_items_count')
            ->selectRaw("SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN ($snapshotLineTotalExpr) ELSE 0 END) AS free_items_snapshot_total")
            ->selectRaw("SUM(CASE WHEN COALESCE(order_items.is_staff_free_applied, false) THEN ($effectiveLineTotalExpr) ELSE 0 END) AS free_items_effective_total")
            ->groupBy('order_item_staff_splits.staff_id')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) $row->staff_id,
                'staff_name' => $row->staff_name,
                'commission_rate' => (float) ($row->commission_rate ?? 0),
                'service_commission_rate' => (float) ($row->service_commission_rate ?? 0),
                'total_sales' => round((float) $row->total_sales, 2),
                'total_commission' => round((float) $row->total_commission, 2),
                'orders_count' => (int) $row->orders_count,
                'items_count' => (int) $row->items_count,
                'package_items_count' => 0,
                'package_sales' => 0,
                'package_commission' => 0,
                'free_items_count' => (int) ($row->free_items_count ?? 0),
                'free_items_snapshot_total' => round((float) ($row->free_items_snapshot_total ?? 0), 2),
                'free_items_effective_total' => round((float) ($row->free_items_effective_total ?? 0), 2),
            ]);

        $packageRows = $this->basePackageCommissionQuery($validated)
            ->selectRaw('service_package_staff_splits.staff_id')
            ->selectRaw('MAX(staffs.name) AS staff_name')
            ->selectRaw('MAX(staffs.commission_rate) AS commission_rate')
            ->selectRaw('MAX(staffs.service_commission_rate) AS service_commission_rate')
            ->selectRaw('SUM(service_package_staff_splits.split_sales_amount) AS total_sales')
            ->selectRaw('SUM(service_package_staff_splits.commission_amount_snapshot) AS total_commission')
            ->selectRaw('COUNT(DISTINCT orders.id) AS orders_count')
            ->selectRaw('COUNT(DISTINCT service_package_staff_splits.customer_service_package_id) AS package_items_count')
            ->groupBy('service_package_staff_splits.staff_id')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) $row->staff_id,
                'staff_name' => $row->staff_name,
                'commission_rate' => (float) ($row->commission_rate ?? 0),
                'service_commission_rate' => (float) ($row->service_commission_rate ?? 0),
                'total_sales' => round((float) $row->total_sales, 2),
                'total_commission' => round((float) $row->total_commission, 2),
                'orders_count' => (int) $row->orders_count,
                'items_count' => 0,
                'package_items_count' => (int) ($row->package_items_count ?? 0),
                'package_sales' => round((float) $row->total_sales, 2),
                'package_commission' => round((float) $row->total_commission, 2),
                'free_items_count' => 0,
                'free_items_snapshot_total' => 0,
                'free_items_effective_total' => 0,
            ]);

        $rows = $productRows
            ->concat($packageRows)
            ->groupBy('staff_id')
            ->map(function ($group) {
                $first = $group->first();

                return [
                    'staff_id' => (int) $first['staff_id'],
                    'staff_name' => $first['staff_name'],
                    'commission_rate' => (float) ($first['commission_rate'] ?? 0),
                    'service_commission_rate' => (float) ($first['service_commission_rate'] ?? 0),
                    'total_sales' => round((float) $group->sum('total_sales'), 2),
                    'total_commission' => round((float) $group->sum('total_commission'), 2),
                    'orders_count' => (int) $group->max('orders_count'),
                    'items_count' => (int) $group->sum('items_count'),
                    'package_items_count' => (int) $group->sum('package_items_count'),
                    'package_sales' => round((float) $group->sum('package_sales'), 2),
                    'package_commission' => round((float) $group->sum('package_commission'), 2),
                    'free_items_count' => (int) $group->sum('free_items_count'),
                    'free_items_snapshot_total' => round((float) $group->sum('free_items_snapshot_total'), 2),
                    'free_items_effective_total' => round((float) $group->sum('free_items_effective_total'), 2),
                ];
            })
            ->sortBy('staff_name')
            ->values();

        $freeItemsByProduct = $this->baseCommissionQuery($validated)
            ->selectRaw('order_items.product_id')
            ->selectRaw('MAX(order_items.product_name_snapshot) AS product_name')
            ->selectRaw('COUNT(*) AS free_items_count')
            ->selectRaw("SUM($snapshotLineTotalExpr) AS free_items_snapshot_total")
            ->selectRaw("SUM($effectiveLineTotalExpr) AS free_items_effective_total")
            ->where('order_items.is_staff_free_applied', true)
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

        return response()->json([
            'range' => [
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
            ],
            'rows' => $rows,
            'grand_total_sales' => round($rows->sum('total_sales'), 2),
            'grand_total_commission' => round($rows->sum('total_commission'), 2),
            'free_items_count' => (int) $rows->sum('free_items_count'),
            'free_items_snapshot_total' => round((float) $rows->sum('free_items_snapshot_total'), 2),
            'free_items_effective_total' => round((float) $rows->sum('free_items_effective_total'), 2),
            'free_items_by_product' => $freeItemsByProduct,
        ]);
    }

    public function detail(Request $request)
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);
        $effectiveLineTotalExpr = $this->effectiveLineTotalExpr();
        $snapshotLineTotalExpr = $this->snapshotLineTotalExpr();
        $commissionRateExpr = $this->commissionRateExpr();

        $productDetailQuery = $this->baseCommissionQuery($validated)
            ->where('order_item_staff_splits.staff_id', $validated['staff_id'])
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw("'product' AS item_type")
            ->selectRaw('order_items.product_name_snapshot AS product_name')
            ->selectRaw('order_items.quantity AS qty')
            ->selectRaw("($effectiveLineTotalExpr) AS item_net_amount")
            ->selectRaw("($snapshotLineTotalExpr) AS item_snapshot_amount")
            ->selectRaw('COALESCE(order_items.is_staff_free_applied, false) AS is_staff_free_applied')
            ->selectRaw('order_item_staff_splits.share_percent')
            ->selectRaw("($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) AS staff_item_sales")
            ->selectRaw('order_item_staff_splits.commission_rate_snapshot AS commission_rate')
            ->selectRaw("($effectiveLineTotalExpr) * (order_item_staff_splits.share_percent::numeric / 100) * ($commissionRateExpr) AS staff_item_commission");

        $packageDetailQuery = $this->basePackageCommissionQuery($validated)
            ->where('service_package_staff_splits.staff_id', $validated['staff_id'])
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw("'service_package' AS item_type")
            ->selectRaw('service_packages.name AS product_name')
            ->selectRaw('1 AS qty')
            ->selectRaw('service_package_staff_splits.split_sales_amount AS item_net_amount')
            ->selectRaw('service_package_staff_splits.split_sales_amount AS item_snapshot_amount')
            ->selectRaw('false AS is_staff_free_applied')
            ->selectRaw('service_package_staff_splits.share_percent')
            ->selectRaw('service_package_staff_splits.split_sales_amount AS staff_item_sales')
            ->selectRaw('service_package_staff_splits.service_commission_rate_snapshot AS commission_rate')
            ->selectRaw('service_package_staff_splits.commission_amount_snapshot AS staff_item_commission');

        $paginator = DB::query()->fromSub($productDetailQuery->unionAll($packageDetailQuery), 'commission_rows')
            ->orderByDesc('commission_rows.order_date')
            ->orderByDesc('commission_rows.order_id')
            ->paginate($perPage)
            ->through(fn ($row) => [
                'order_no' => $row->order_no,
                'order_id' => (int) $row->order_id,
                'order_date' => $row->order_date,
                'item_type' => $row->item_type,
                'product_name' => $row->product_name,
                'qty' => (int) $row->qty,
                'item_net_amount' => round((float) $row->item_net_amount, 2),
                'item_snapshot_amount' => round((float) ($row->item_snapshot_amount ?? 0), 2),
                'is_staff_free_applied' => (bool) $row->is_staff_free_applied,
                'share_percent' => (int) $row->share_percent,
                'staff_item_sales' => round((float) $row->staff_item_sales, 2),
                'commission_rate' => (float) ($row->commission_rate ?? 0),
                'staff_item_commission' => round((float) $row->staff_item_commission, 2),
            ]);

        return response()->json([
            'range' => [
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
            ],
            'staff_id' => (int) $validated['staff_id'],
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    private function baseCommissionQuery(array $filters): Builder
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->join('staffs', 'staffs.id', '=', 'order_item_staff_splits.staff_id')
            ->whereDate('orders.created_at', '>=', $filters['start_date'])
            ->whereDate('orders.created_at', '<=', $filters['end_date'])
            ->where(function (Builder $query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function (Builder $query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->when(isset($filters['staff_id']), function (Builder $query) use ($filters) {
                $query->where('order_item_staff_splits.staff_id', $filters['staff_id']);
            });
    }

    private function basePackageCommissionQuery(array $filters): Builder
    {
        return DB::table('orders')
            ->join('customer_service_packages', function ($join) {
                $join->on('customer_service_packages.purchased_ref_id', '=', 'orders.id')
                    ->where('customer_service_packages.purchased_from', 'POS');
            })
            ->join('service_package_staff_splits', 'service_package_staff_splits.customer_service_package_id', '=', 'customer_service_packages.id')
            ->join('staffs', 'staffs.id', '=', 'service_package_staff_splits.staff_id')
            ->join('service_packages', 'service_packages.id', '=', 'customer_service_packages.service_package_id')
            ->whereDate('orders.created_at', '>=', $filters['start_date'])
            ->whereDate('orders.created_at', '<=', $filters['end_date'])
            ->where(function (Builder $query) {
                $query->where('orders.status', 'completed')
                    ->orWhere('orders.payment_status', 'paid');
            })
            ->whereNotIn('orders.status', ['cancelled', 'draft', 'voided'])
            ->where(function (Builder $query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->when(isset($filters['staff_id']), function (Builder $query) use ($filters) {
                $query->where('service_package_staff_splits.staff_id', $filters['staff_id']);
            });
    }

    private function effectiveLineTotalExpr(): string
    {
        return 'COALESCE(order_items.effective_line_total, order_items.line_total)::numeric';
    }

    private function snapshotLineTotalExpr(): string
    {
        return 'COALESCE(order_items.line_total_snapshot, order_items.line_total)::numeric';
    }

    private function commissionRateExpr(): string
    {
        return '(CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END)';
    }
}
