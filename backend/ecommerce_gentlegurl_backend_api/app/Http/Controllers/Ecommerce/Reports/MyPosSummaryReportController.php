<?php

namespace App\Http\Controllers\Ecommerce\Reports;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MyPosSummaryReportController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $user = $request->user();
        $perPage = (int) ($validated['per_page'] ?? 20);

        $ordersCount = (clone $this->baseOrderQuery($validated, (int) $user->id))
            ->distinct('orders.id')
            ->count('orders.id');

        $itemsCount = (clone $this->baseOrderQuery($validated, (int) $user->id))
            ->count('order_items.id');

        $itemsWithStaffCount = (clone $this->baseOrderQuery($validated, (int) $user->id))
            ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->distinct('order_items.id')
            ->count('order_items.id');

        $itemsWithoutStaffCount = max(0, $itemsCount - $itemsWithStaffCount);

        $totalItemAmount = (float) ((clone $this->baseOrderQuery($validated, (int) $user->id))
            ->selectRaw('COALESCE(SUM(order_items.line_total::numeric), 0) AS total_item_amount')
            ->value('total_item_amount') ?? 0);

        $totalStaffCommission = (float) ((clone $this->baseOrderQuery($validated, (int) $user->id))
            ->leftJoin('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
            ->selectRaw('COALESCE(SUM((order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) * (CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END), 0) AS total_staff_commission')
            ->value('total_staff_commission') ?? 0);

        $myCommission = 0.0;
        if ($user->staff_id) {
            $myCommission = (float) ((clone $this->baseOrderQuery($validated, (int) $user->id))
                ->join('order_item_staff_splits', 'order_item_staff_splits.order_item_id', '=', 'order_items.id')
                ->where('order_item_staff_splits.staff_id', (int) $user->staff_id)
                ->selectRaw('COALESCE(SUM((order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) * (CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END), 0) AS my_commission')
                ->value('my_commission') ?? 0);
        }

        $paginator = (clone $this->baseOrderQuery($validated, (int) $user->id))
            ->selectRaw('orders.id AS order_id')
            ->selectRaw('orders.order_number AS order_no')
            ->selectRaw('orders.created_at AS order_date')
            ->selectRaw('order_items.id AS order_item_id')
            ->selectRaw('order_items.product_name_snapshot AS product_name')
            ->selectRaw('order_items.quantity AS qty')
            ->selectRaw('order_items.line_total::numeric AS item_total_price')
            ->selectRaw('EXISTS (SELECT 1 FROM order_item_staff_splits oiss WHERE oiss.order_item_id = order_items.id) AS has_staff_assignment')
            ->orderByDesc('orders.created_at')
            ->orderByDesc('order_items.id')
            ->paginate($perPage);

        $itemIds = collect($paginator->items())->pluck('order_item_id')->map(fn ($v) => (int) $v)->all();

        $splitsGrouped = collect();
        if (! empty($itemIds)) {
            $splitsGrouped = DB::table('order_item_staff_splits')
                ->leftJoin('staffs', 'staffs.id', '=', 'order_item_staff_splits.staff_id')
                ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
                ->whereIn('order_item_staff_splits.order_item_id', $itemIds)
                ->selectRaw('order_item_staff_splits.order_item_id')
                ->selectRaw('order_item_staff_splits.staff_id')
                ->selectRaw('staffs.name AS staff_name')
                ->selectRaw('order_item_staff_splits.share_percent')
                ->selectRaw('order_item_staff_splits.commission_rate_snapshot')
                ->selectRaw('(order_items.line_total::numeric) * (order_item_staff_splits.share_percent::numeric / 100) * (CASE WHEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric > 1 THEN COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric / 100 ELSE COALESCE(order_item_staff_splits.commission_rate_snapshot, 0)::numeric END) AS staff_commission_amount')
                ->orderBy('order_item_staff_splits.id')
                ->get()
                ->map(fn ($row) => [
                    'order_item_id' => (int) $row->order_item_id,
                    'staff_id' => $row->staff_id ? (int) $row->staff_id : null,
                    'staff_name' => $row->staff_name,
                    'share_percent' => (int) $row->share_percent,
                    'commission_rate_snapshot' => (float) ($row->commission_rate_snapshot ?? 0),
                    'staff_commission_amount' => round((float) $row->staff_commission_amount, 2),
                ])
                ->groupBy('order_item_id');
        }

        $details = collect($paginator->items())
            ->map(fn ($row) => [
                'order_no' => $row->order_no,
                'order_id' => (int) $row->order_id,
                'order_date' => $row->order_date,
                'order_item_id' => (int) $row->order_item_id,
                'product_name' => $row->product_name,
                'qty' => (int) $row->qty,
                'item_total_price' => round((float) $row->item_total_price, 2),
                'has_staff_assignment' => (bool) $row->has_staff_assignment,
                'staff_splits' => ($splitsGrouped->get((int) $row->order_item_id) ?? collect())->values(),
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
            ],
            'data' => $details,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    private function baseOrderQuery(array $filters, int $currentUserId): Builder
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.created_by_user_id', $currentUserId)
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
    }
}
