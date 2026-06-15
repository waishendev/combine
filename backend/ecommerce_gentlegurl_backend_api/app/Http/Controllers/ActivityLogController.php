<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 50), 1), 200);

        $query = ActivityLog::query()->latest('created_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('model_type')) {
            $query->where('model_type', $request->input('model_type'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('model_label', 'ilike', "%{$search}%")
                  ->orWhere('user_name', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $logs = $query->paginate($perPage);

        $rows = $logs->getCollection()->map(function (ActivityLog $log) {
            return [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name,
                'action' => $log->action,
                'model_type' => $log->model_type,
                'model_id' => $log->model_id,
                'model_label' => $log->model_label,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->format('Y-m-d H:i:s'),
            ];
        })->values();

        return $this->respond([
            'rows' => $rows,
            'pagination' => [
                'total' => $logs->total(),
                'per_page' => $logs->perPage(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
            ],
            'filters' => [
                'model_types' => ActivityLog::query()
                    ->distinct()
                    ->orderBy('model_type')
                    ->pluck('model_type'),
                'users' => ActivityLog::query()
                    ->whereNotNull('user_id')
                    ->selectRaw('DISTINCT user_id, user_name')
                    ->orderBy('user_name')
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->user_id,
                        'name' => $row->user_name,
                    ]),
            ],
        ]);
    }
}
