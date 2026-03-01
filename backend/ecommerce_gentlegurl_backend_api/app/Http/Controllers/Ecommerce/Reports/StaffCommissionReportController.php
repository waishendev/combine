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

        $rows = $this->baseCommissionQuery($validated)
            ->selectRaw('order_item_staff_splits.staff_id')
            ->selectRaw('MAX(staffs.name) AS staff_name')
            ->selectRaw('MAX(staffs.commission_rate) AS commission_rate')
            ->selectRaw('SUM((order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100)) AS total_sales')
            ->selectRaw('SUM((order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) * (CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END)) AS total_commission')
            ->selectRaw('COUNT(DISTINCT orders.id) AS orders_count')
            ->selectRaw('COUNT(DISTINCT order_items.id) AS items_count')
            ->groupBy('order_item_staff_splits.staff_id')
            ->orderBy('staff_name')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => (int) $row->staff_id,
                'staff_name' => $row->staff_name,
                'commission_rate' => (float) ($row->commission_rate ?? 0),
                'total_sales' => round((float) $row->total_sales, 2),
                'total_commission' => round((float) $row->total_commission, 2),
                'orders_count' => (int) $row->orders_count,
                'items_count' => (int) $row->items_count,
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

        $paginator = $this->baseCommissionQuery($validated)
            ->where('order_item_staff_splits.staff_id', $validated['staff_id'])
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw('order_items.id AS order_item_id')
            ->selectRaw('order_items.product_name_snapshot AS product_name')
            ->selectRaw('order_items.quantity AS qty')
            ->selectRaw('order_items.line_total::numeric AS item_net_amount')
            ->selectRaw('order_item_staff_splits.share_percent')
            ->selectRaw('(order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) AS staff_item_sales')
            ->selectRaw('order_item_staff_splits.commission_rate_snapshot AS commission_rate')
            ->selectRaw('(order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) * (CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END) AS staff_item_commission')
            ->orderByDesc('orders.created_at')
            ->orderByDesc('order_items.id')
            ->paginate($perPage)
            ->through(fn ($row) => [
                'order_no' => $row->order_no,
                'order_id' => (int) $row->order_id,
                'order_date' => $row->order_date,
                'product_name' => $row->product_name,
                'qty' => (int) $row->qty,
                'item_net_amount' => round((float) $row->item_net_amount, 2),
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
            ->whereNotIn('orders.status', ['cancelled', 'draft'])
            ->where(function (Builder $query) {
                $query->where('orders.payment_status', '!=', 'refunded')
                    ->orWhereNull('orders.payment_status');
            })
            ->whereNull('orders.refunded_at')
            ->when(isset($filters['staff_id']), function (Builder $query) use ($filters) {
                $query->where('order_item_staff_splits.staff_id', $filters['staff_id']);
            });
    }
}
