<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\StaffCommissionLog;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CommissionLogController extends Controller
{
    public function index(Request $request)
    {
        $query = StaffCommissionLog::query()
            ->with(['staff:id,name', 'performer:id,name']);

        if ($request->filled('type')) {
            $query->where('type', strtoupper((string) $request->query('type')));
        }
        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->query('staff_id'));
        }
        if ($request->filled('year')) {
            $query->where('year', (int) $request->query('year'));
        }
        if ($request->filled('month')) {
            $query->where('month', (int) $request->query('month'));
        }
        if ($request->filled('action')) {
            $query->where('action', strtoupper((string) $request->query('action')));
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', Carbon::parse($request->query('from'))->startOfDay());
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', Carbon::parse($request->query('to'))->endOfDay());
        }
        if ($request->filled('remarks')) {
            $remarks = trim((string) $request->query('remarks'));
            $query->where('remarks', 'like', '%' . $remarks . '%');
        }
        if ($request->filled('keyword')) {
            $keyword = trim((string) $request->query('keyword'));
            $query->where(function ($inner) use ($keyword) {
                $inner->where('remarks', 'like', '%' . $keyword . '%')
                    ->orWhere('action', 'like', '%' . strtoupper($keyword) . '%')
                    ->orWhereHas('staff', fn ($staffQuery) => $staffQuery->where('name', 'like', '%' . $keyword . '%'));
            });
        }

        $paginator = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 50));

        $paginator->getCollection()->transform(function (StaffCommissionLog $log) {
            $log->staff_name = $log->staff?->name;
            $log->performed_by_name = $log->performer?->name;

            return $log;
        });

        return $this->respond($paginator);
    }
}
