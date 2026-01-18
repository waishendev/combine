<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\VoucherAssignLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class VoucherAssignLogController extends Controller
{
    public function index(Request $request)
    {
        return $this->respond($this->buildLogsResponse($request));
    }

    public function customerLogs(Request $request, Customer $customer)
    {
        return $this->respond($this->buildLogsResponse($request, $customer));
    }

    private function buildLogsResponse(Request $request, ?Customer $customer = null): array
    {
        $perPage = $request->integer('per_page', 20);
        $page = $request->integer('page', 1);
        [$start, $end] = $this->resolveDateRange($request);

        $query = VoucherAssignLog::query()
            ->with(['admin', 'customer', 'voucher'])
            ->when($customer, fn ($q) => $q->where('customer_id', $customer->id))
            ->when(
                $request->filled('customer_id'),
                fn ($q) => $q->where('customer_id', $request->integer('customer_id'))
            )
            ->when(
                $request->filled('voucher_id'),
                fn ($q) => $q->where('voucher_id', $request->integer('voucher_id'))
            )
            ->when(
                $request->filled('admin_id'),
                fn ($q) => $q->where('assigned_by_admin_id', $request->integer('admin_id'))
            )
            ->when(
                $start && $end,
                fn ($q) => $q->whereBetween('assigned_at', [$start, $end])
            )
            ->when(
                $start && !$end,
                fn ($q) => $q->where('assigned_at', '>=', $start)
            )
            ->when(
                !$start && $end,
                fn ($q) => $q->where('assigned_at', '<=', $end)
            )
            ->when($request->filled('customer_query'), function ($q) use ($request) {
                $term = $request->string('customer_query')->toString();
                $q->whereHas('customer', function ($customerQuery) use ($term) {
                    $customerQuery->where('name', 'like', '%' . $term . '%')
                        ->orWhere('email', 'like', '%' . $term . '%');
                });
            })
            ->when($request->filled('voucher_query'), function ($q) use ($request) {
                $term = $request->string('voucher_query')->toString();
                $q->whereHas('voucher', function ($voucherQuery) use ($term) {
                    $voucherQuery->where('code', 'like', '%' . $term . '%');
                });
            })
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = $request->string('q')->toString();
                $q->where(function ($subQuery) use ($term) {
                    $subQuery
                        ->whereHas('customer', function ($customerQuery) use ($term) {
                            $customerQuery->where('name', 'like', '%' . $term . '%')
                                ->orWhere('email', 'like', '%' . $term . '%');
                        })
                        ->orWhereHas('voucher', function ($voucherQuery) use ($term) {
                            $voucherQuery->where('code', 'like', '%' . $term . '%');
                        })
                        ->orWhere('note', 'like', '%' . $term . '%');
                });
            })
            ->orderByDesc('assigned_at');

        $logs = $query->paginate($perPage, ['*'], 'page', $page);

        $rows = $logs->getCollection()->map(function (VoucherAssignLog $log) {
            return [
                'id' => $log->id,
                'assigned_at' => $log->assigned_at?->format('Y-m-d H:i:s'),
                'admin_id' => $log->assigned_by_admin_id,
                'admin_name' => $log->admin?->name ?? $log->admin?->username ?? '-',
                'customer_id' => $log->customer_id,
                'customer_name' => $log->customer?->name ?? '-',
                'customer_email' => $log->customer?->email ?? '-',
                'voucher_id' => $log->voucher_id,
                'voucher_code' => $log->voucher?->code ?? '-',
                'voucher_name' => $log->voucher?->name ?? null,
                'quantity' => $log->quantity,
                'start_at' => $log->start_at?->format('Y-m-d H:i:s'),
                'end_at' => $log->end_at?->format('Y-m-d H:i:s'),
                'note' => $log->note,
            ];
        })->values();

        return [
            'date_range' => [
                'from' => $start?->toDateString(),
                'to' => $end?->toDateString(),
            ],
            'rows' => $rows,
            'pagination' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
        ];
    }

    private function resolveDateRange(Request $request): array
    {
        $hasDateFrom = $request->filled('date_from');
        $hasDateTo = $request->filled('date_to');

        if (!($hasDateFrom && $hasDateTo)) {
            $today = Carbon::today();
            $start = $today->copy()->startOfMonth();
            $end = $today->copy()->endOfMonth()->endOfDay();
        } else {
            $start = Carbon::parse($request->query('date_from'))->startOfDay();
            $end = Carbon::parse($request->query('date_to'))->endOfDay();
        }

        return [$start, $end];
    }
}
